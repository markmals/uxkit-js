import {
    CXChildVisitResult,
    CXCursor,
    CXCursorKind,
    CXIndex,
    CXObjCPropertyAttrKind,
    CXTypeNullabilityKind,
} from 'clang';

// Be sure to set the LIBCLANG_PATH env var before running this script
// Should be here:
// /Applications/Xcode-16.2.0.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/libclang.dylib
//
// Test run this script using: deno run -A ./scripts/clang-extractor.ts '/path/to/header.h'

// Set this to an empty string if you don't use `Xcodes` to install your Xcode versions
const XCODE_VERSION = '-16.2.0';

class ObjCClass {
    readonly className: string;
    readonly methods: ObjCMethod[] = [];
    readonly properties: ObjCProperty[] = [];

    constructor({ cursor }: { cursor: CXCursor }) {
        this.className = cursor.getSpelling();
    }
}

class ObjCMethod {
    readonly selector: string;
    readonly arguments: ObjCMethodArgs[];
    readonly isStatic: boolean;
    readonly returnType: string;

    constructor({ cursor, isStatic }: { cursor: CXCursor; isStatic: boolean }) {
        this.isStatic = isStatic;
        this.selector = cursor.getSpelling();
        // FIXME: We should get the type that is listed in the header
        // (e.g. `NSButtonType` instead of `id`)
        this.returnType = cursor.getResultType()!.getSpelling();

        const args = cursor.getNumberOfArguments();
        this.arguments = args > 0
            ? Array(args)
                .fill(null)
                .map((_, index) => new ObjCMethodArgs({ cursor, index }))
            : [];
    }
}

class ObjCMethodArgs {
    readonly name: string;
    readonly type: string;
    readonly isNullable: boolean;

    constructor({ cursor, index }: { cursor: CXCursor; index: number }) {
        const arg = cursor.getArgument(index)!;
        const type = arg.getType()!;

        this.name = arg.getSpelling();
        this.type = type.getSpelling();
        this.isNullable = type.getNullability() ===
            CXTypeNullabilityKind.CXTypeNullability_Nullable;
    }
}

class ObjCProperty {
    readonly isNullable: boolean;
    readonly isReadonly: boolean;
    readonly getterSelector: string;
    readonly setterSelector?: string;
    readonly type: string;

    constructor({ cursor }: { cursor: CXCursor }) {
        const type = cursor.getType()!;
        const attributes = cursor.getObjCPropertyAttributes();

        this.getterSelector = cursor.getObjCPropertyGetterName();
        this.setterSelector = cursor.getObjCPropertySetterName();
        this.isReadonly = (attributes & CXObjCPropertyAttrKind.CXObjCPropertyAttr_readonly) !== 0;
        this.isNullable =
            type.getNullability() === CXTypeNullabilityKind.CXTypeNullability_Nullable;
        // FIXME: We should get the type that is listed in the header
        // (e.g. `NSButtonType` instead of `id`)
        this.type = type.getSpelling();
    }
}

const classes = [] as ObjCClass[];

function visitor(cursor: CXCursor): CXChildVisitResult {
    // Only process cursors from the main file.
    if (!cursor.getLocation().isFromMainFile()) {
        return CXChildVisitResult.CXChildVisit_Continue;
    }

    switch (cursor.kind) {
        case CXCursorKind.CXCursor_ObjCInterfaceDecl: {
            const definition = new ObjCClass({ cursor });

            // TODO: Grab the superclass and protocol conformances
            cursor.visitChildren((child) => {
                switch (child.kind) {
                    case CXCursorKind.CXCursor_ObjCInstanceMethodDecl: {
                        definition.methods.push(new ObjCMethod({ cursor: child, isStatic: false }));
                        break;
                    }
                    case CXCursorKind.CXCursor_ObjCClassMethodDecl: {
                        definition.methods.push(new ObjCMethod({ cursor: child, isStatic: true }));
                        break;
                    }
                    case CXCursorKind.CXCursor_ObjCPropertyDecl: {
                        definition.properties.push(new ObjCProperty({ cursor: child }));
                        break;
                    }
                    default: {
                        return CXChildVisitResult.CXChildVisit_Continue;
                    }
                }

                return CXChildVisitResult.CXChildVisit_Continue;
            });

            classes.push(definition);

            break;
        }
        default: {
            break;
        }
    }

    return CXChildVisitResult.CXChildVisit_Continue;
}

// Create a new index (false: include declarations from PCH, true: display diagnostics)
const index = new CXIndex(false, true);

const headerPath = Deno.args[0];
// Parse the header file contents into a translation unit
const unit = index.parseTranslationUnit(headerPath, [
    '-x',
    'objective-c',
    '-isysroot',
    `/Applications/Xcode${XCODE_VERSION}.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`,
    '-F',
    '/System/Library/Frameworks',
]);

unit.getCursor().visitChildren(visitor);

console.log(JSON.stringify(classes, null, 4));

unit.dispose();
index.dispose();
