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

interface ObjCClass {
    className: string;
    methods: ObjCMethod[];
    properties: ObjCProperty[];
}

interface ObjCMethod {
    selector: string;
    arguments: ObjCMethodArgs[];
    isStatic: boolean;
    returnType: string;
}

interface ObjCMethodArgs {
    name: string;
    type: string;
    isNullable: boolean;
}

interface ObjCProperty {
    isNullable: boolean;
    isReadonly: boolean;
    getterSelector: string;
    setterSelector?: string;
    type: string;
}

const classes = [] as ObjCClass[];

function parseMethodDecl(
    { cursor, isStatic }: { cursor: CXCursor; isStatic: boolean },
): ObjCMethod {
    const argsNum = cursor.getNumberOfArguments();
    // FIXME: We should get the type that is listed in the header
    // (e.g. `NSButtonType` instead of `id`)
    const returnType = cursor.getResultType()!.getSpelling();

    const args = argsNum > 0
        ? Array(argsNum)
            .fill(null)
            .map((_, idx) => {
                const arg = cursor.getArgument(idx)!;
                const type = arg.getType()!;
                const isNullable = type.getNullability() ===
                    CXTypeNullabilityKind.CXTypeNullability_Nullable;

                return ({
                    name: arg.getSpelling(),
                    // FIXME: We should get the type that is listed in the header
                    // (e.g. `NSButtonType` instead of `id`)
                    type: type.getSpelling(),
                    isNullable,
                });
            })
        : [];

    return {
        isStatic,
        selector: cursor.getSpelling(),
        arguments: args,
        returnType,
    };
}

function parsePropertyDecl({ cursor }: { cursor: CXCursor }): ObjCProperty {
    const getterSelector = cursor.getObjCPropertyGetterName();
    const setterSelector = cursor.getObjCPropertySetterName();

    const type = cursor.getType()!;
    const attributes = cursor.getObjCPropertyAttributes();
    const isReadonly = (attributes & CXObjCPropertyAttrKind.CXObjCPropertyAttr_readonly) !== 0;

    return {
        isNullable: type.getNullability() === CXTypeNullabilityKind.CXTypeNullability_Nullable,
        isReadonly,
        getterSelector,
        setterSelector,
        // FIXME: We should get the type that is listed in the header
        // (e.g. `NSButtonType` instead of `id`)
        type: type.getSpelling(),
    };
}

function visitor(cursor: CXCursor): CXChildVisitResult {
    // Only process cursors from the main file.
    if (!cursor.getLocation().isFromMainFile()) {
        return CXChildVisitResult.CXChildVisit_Continue;
    }

    switch (cursor.kind) {
        case CXCursorKind.CXCursor_ObjCInterfaceDecl: {
            const definition: ObjCClass = {
                className: cursor.getSpelling(),
                methods: [],
                properties: [],
            };

            // TODO: Grab the superclass and protocol conformances
            cursor.visitChildren((child) => {
                switch (child.kind) {
                    case CXCursorKind.CXCursor_ObjCInstanceMethodDecl: {
                        const parsed = parseMethodDecl({ cursor: child, isStatic: false });
                        definition.methods.push(parsed);
                        break;
                    }
                    case CXCursorKind.CXCursor_ObjCClassMethodDecl: {
                        const parsed = parseMethodDecl({ cursor: child, isStatic: true });
                        definition.methods.push(parsed);
                        break;
                    }
                    case CXCursorKind.CXCursor_ObjCPropertyDecl: {
                        const parsed = parsePropertyDecl({ cursor: child });
                        definition.properties.push(parsed);
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

console.log(Deno.inspect(classes, { depth: 10 }));

unit.dispose();
index.dispose();
