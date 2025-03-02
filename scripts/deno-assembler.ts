import { ClassDeclaration, Project, Scope } from 'npm:ts-morph';
import { SourceFile } from 'npm:ts-morph';

const PROJ = new Project();

export function buildFile({ forClass: classRef, into: project }: { forClass: any; into: Project }) {
    const file = project.createSourceFile(`./src/generated/${classRef.name}.ts`, '', {
        overwrite: true,
    });

    // MARK: Imports
    file.addImportDeclaration({
        defaultImport: 'objc',
        moduleSpecifier: 'objc',
    });

    file.addImportDeclaration({
        namedImports: ['id'],
        moduleSpecifier: '../objc.ts',
    });

    // Add parent class import if needed
    if (classRef.superclass) {
        file.addImportDeclaration({
            namedImports: [classRef.superclass],
            moduleSpecifier: `./${classRef.superclass}.ts`,
        });
    }

    buildClass({ class: classRef, into: file });
}

export function buildClass({ into: file, ...params }: { into: SourceFile; class: any }) {
    const classDeclaration = file.addClass({
        name: params.class.name,
        isExported: true,
        extends: params.class.superclass ? params.class.superclass : undefined,
    });

    // Add static class reference
    classDeclaration.addProperty({
        name: 'Class',
        type: undefined,
        initializer: `objc.classes["${params.class.name}"]`,
        isStatic: true,
        isReadonly: true,
        scope: Scope.Private,
    });

    // Add internal `id` pointer
    classDeclaration.addProperty({
        name: 'pointer',
        type: 'id',
        scope: Scope.Protected,
    });

    // Process properties
    for (const property of params.class.properties) {
        // Skip properties that failed to parse correctly
        if (!property.name) continue;
        buildProperty({ property, into: classDeclaration });
    }

    // Add constructor
    const constructor = classDeclaration.addConstructor({
        scope: Scope.Public,
        parameters: params.class.inits.at(0).parameters,
        overloads: params.class.inits.slice(1).map((init) => ({ parameters: init.parameters })),
    });

    constructor.setBodyText((writer) => {
        writer
            .writeLine('super();')
            .writeLine(`const memory = objc.msgSend(${params.class.name}.Class, "alloc")`);

        for (const init of params.class.inits) {
            writer.write(`if (${init.parameters.join(' || ')})`).block(() => {
                writer.writeLine(`this.pointer = objc.msgSend(memory, ${init.selector});`);
            });
        }
    });

    for (const method of params.class.methods) {
        // Skip initializers as we handle them in the constructor
        if (method.name.startsWith('init')) continue;
        buildMethod({ method, into: classDeclaration });
    }
}

export function buildProperty({
    property,
    into: classDeclaration,
}: {
    property: any;
    into: ClassDeclaration;
}) {
    // Convert property type to TypeScript
    const type = toTypeScriptType(property.type);

    // Create getter
    const getterName = property.name;
    const getter = classDeclaration.addGetAccessor({
        name: getterName,
        scope: Scope.Public,
        returnType: type,
    });
    getter.setBodyText(`return objc.msgSend(this.pointer, "${getterName}");`);

    // Create setter if property is not read-only
    if (!property.isReadOnly) {
        const setter = classDeclaration.addSetAccessor({
            name: getterName,
            scope: Scope.Public,
            parameters: [
                {
                    name: 'newValue',
                    type: type,
                },
            ],
        });

        // Objective-C setter method name is "setPropertyName:"
        const setterMethodName = `set${getterName.charAt(0).toUpperCase()}${getterName.slice(1)}:`;
        setter.setBodyText(`objc.msgSend(this.pointer, "${setterMethodName}", newValue);`);
    }
}
