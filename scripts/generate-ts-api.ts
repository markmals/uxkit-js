// deno-lint-ignore-file

/**
 * Represents a parameter in an Objective-C method
 */
interface ObjCParameter {
    name: string;
    type: string;
    isNullable: boolean;
    documentation: string;
}

/**
 * Represents an Objective-C method
 */
interface ObjCMethod {
    isClassMethod: boolean;
    returnType: string;
    name: string;
    parameters: ObjCParameter[];
    documentation: string;
    returnDocumentation: string;
    availability?: string;
}

/**
 * Represents a property in an Objective-C class
 */
interface ObjCProperty {
    name: string;
    type: string;
    isReadOnly: boolean;
    isNullable: boolean;
    documentation: string;
    attributes: string[];
}

/**
 * Represents an Objective-C class
 */
interface ObjCClass {
    name: string;
    superclass: string;
    protocols: string[];
    properties: ObjCProperty[];
    methods: ObjCMethod[];
    documentation: string;
    availability?: string;
}

/**
 * Parse a documentation comment block
 * @param docComment The documentation comment to parse
 * @returns An object containing the main documentation and parameter/return documentation
 */
function parseDocumentation(docComment: string): {
    mainDoc: string;
    paramDocs: Record<string, string>;
    returnDoc: string;
} {
    // Clean up the comment by removing comment markers and extra whitespace
    const cleanedComment = docComment
        .replace(/\/\*!|\*\/|^\s*\*\s*/gm, "") // Remove comment markers
        .trim();

    // Split into lines and filter out empty lines
    const lines = cleanedComment
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const paramDocs: Record<string, string> = {};
    let returnDoc = "";
    const mainDocLines: string[] = [];

    let currentParam = "";
    let currentParamDoc = "";

    // Handle single-line documentation with @param tags
    if (lines.length === 1 && lines[0].includes("@param")) {
        const singleLine = lines[0];

        // Extract the main documentation (everything before the first @param)
        const mainDocMatch = singleLine.match(/^(.*?)(?=@param|$)/);
        if (mainDocMatch && mainDocMatch[1].trim()) {
            mainDocLines.push(mainDocMatch[1].trim());
        }

        // Extract all @param tags and their documentation
        const paramMatches = singleLine.matchAll(/@param\s+(\w+)\s+([^@]+)/g);
        for (const match of paramMatches) {
            const paramName = match[1];
            const paramDoc = match[2].trim();
            paramDocs[paramName] = paramDoc;
        }

        // Extract the @return tag and its documentation
        const returnMatch = singleLine.match(/@return\s+([^@]+)(?=@|$)/);
        if (returnMatch) {
            returnDoc = returnMatch[1].trim();
        }
    } else {
        // Process multi-line documentation
        for (const line of lines) {
            if (line.startsWith("@param")) {
                // Save previous param if exists
                if (currentParam) {
                    paramDocs[currentParam] = currentParamDoc.trim();
                    currentParamDoc = "";
                }

                // Extract new param name and start of documentation
                const paramMatch = line.match(/@param\s+(\w+)\s+(.*)/);
                if (paramMatch) {
                    currentParam = paramMatch[1];
                    currentParamDoc = paramMatch[2] || "";
                }
            } else if (line.startsWith("@return")) {
                // Save previous param if exists
                if (currentParam) {
                    paramDocs[currentParam] = currentParamDoc.trim();
                    currentParam = "";
                    currentParamDoc = "";
                }

                returnDoc = line.replace("@return", "").trim();
            } else if (currentParam) {
                // Continue previous param documentation
                currentParamDoc += " " + line;
            } else if (!line.startsWith("@")) {
                // Main documentation
                mainDocLines.push(line);
            }
        }

        // Save last param if exists
        if (currentParam) {
            paramDocs[currentParam] = currentParamDoc.trim();
        }
    }

    return {
        mainDoc: mainDocLines.join(" ").trim(),
        paramDocs,
        returnDoc,
    };
}

/**
 * Parse an Objective-C method signature
 * @param signature The method signature to parse
 * @returns The parsed method information
 */
function parseMethodSignature(
    signature: string,
): Omit<ObjCMethod, "documentation" | "returnDocumentation"> {
    // Clean up the signature
    signature = signature.trim();
    if (signature.endsWith(";")) {
        signature = signature.slice(0, -1);
    }

    // Determine if it's a class or instance method
    const isClassMethod = signature.startsWith("+");

    // First, extract the return type
    const returnTypeMatch = signature.match(/[+-]\s*\(([\w\s*]+)\)/);
    if (!returnTypeMatch) {
        throw new Error(`Failed to parse return type from signature: ${signature}`);
    }
    const returnType = returnTypeMatch[1].trim();

    // Extract the method name and parameters
    // This regex looks for patterns like "buttonWithTitle:(NSString *)title"
    const methodNameMatch = signature.match(/[+-]\s*\([^)]+\)\s*(\w+(?:With\w+)?)/);
    if (!methodNameMatch) {
        throw new Error(`Failed to parse method name from signature: ${signature}`);
    }
    const baseMethodName = methodNameMatch[1].trim();

    // Parse parameters
    const parameters: ObjCParameter[] = [];

    // Use a regex to match all parameter patterns in the form "name:(type *)paramName"
    const paramRegex = /(\w+):\s*\(([^)]+)\)\s*(\w+)/g;
    let paramMatch;

    while ((paramMatch = paramRegex.exec(signature)) !== null) {
        const paramType = paramMatch[2].trim();
        const paramName = paramMatch[3];
        const isNullable = paramType.includes("nullable");

        // Clean up the type
        const cleanType = paramType.replace("nullable", "").replace("*", "").trim();

        parameters.push({
            name: paramName,
            type: cleanType,
            isNullable,
            documentation: "",
        });
    }

    // Extract availability information
    let availability = "";
    const availabilityMatch = signature.match(/API_AVAILABLE\(([^)]+)\)/);
    if (availabilityMatch) {
        availability = availabilityMatch[1];
        // Make sure the availability string has a closing parenthesis if needed
        if (availability.includes("(") && !availability.endsWith(")")) {
            availability += ")";
        }
    }

    // Construct the full Objective-C method name with colons
    // Extract all parameter component names from the signature
    const componentNames = signature.match(/(\w+):/g) || [];
    let fullMethodName = baseMethodName;

    // Only add colons if there are parameters
    if (componentNames.length > 0) {
        fullMethodName += ":";
        // Add remaining component names with colons
        for (let i = 1; i < componentNames.length; i++) {
            fullMethodName += componentNames[i];
        }
    }

    return {
        isClassMethod,
        returnType,
        name: fullMethodName,
        parameters,
        availability,
    };
}

/**
 * Convert an Objective-C type to a TypeScript type
 * @param objcType The Objective-C type
 * @returns The equivalent TypeScript type
 */
function convertTypeToTypeScript(objcType: string, isNullable: boolean = false): string {
    const typeMap: Record<string, string> = {
        NSString: "string",
        NSNumber: "number",
        NSInteger: "number",
        NSUInteger: "number",
        BOOL: "boolean",
        CGFloat: "number",
        double: "number",
        float: "number",
        int: "number",
        long: "number",
        char: "string",
        id: "any",
        instancetype: "any",
        void: "void",
        NSArray: "Array<any>",
        NSDictionary: "Record<string, any>",
        NSSet: "Set<any>",
        NSImage: "any", // Platform-specific type
        SEL: "string", // Selector is represented as a string
    };

    let tsType = typeMap[objcType] || objcType;

    if (isNullable) {
        tsType += " | null";
    }

    return tsType;
}

/**
 * Convert an Objective-C method to a TypeScript method definition
 * @param method The Objective-C method
 * @returns The TypeScript method definition
 */
function convertMethodToTypeScript(method: ObjCMethod): string {
    const tsParams = method.parameters
        .map(param => {
            const tsType = convertTypeToTypeScript(param.type, param.isNullable);
            return `${param.name}${param.isNullable ? "?" : ""}: ${tsType}`;
        })
        .join(", ");

    const tsReturnType = convertTypeToTypeScript(method.returnType);

    // For class methods, add 'static'
    const methodPrefix = method.isClassMethod ? "static " : "";

    // Extract the base method name without the parameter components
    let methodName = method.name;
    if (methodName.includes(":")) {
        // For Objective-C style methods like "buttonWithTitle:image:target:action:"

        // First, get the base name (everything before the first colon)
        const baseName = methodName.split(":")[0];

        // Then get the parameter components (the parts between colons)
        const paramComponents = methodName.match(/(\w+):/g) || [];

        // Remove the colons and capitalize the first letter of each component (except the first one)
        methodName = baseName;
        for (let i = 1; i < paramComponents.length; i++) {
            const component = paramComponents[i].replace(":", "");
            if (component.length > 0) {
                methodName += component.charAt(0).toUpperCase() + component.slice(1);
            }
        }
    }

    // Add availability as a JSDoc comment if present
    let jsDoc = "";
    if (method.availability) {
        jsDoc = `/**\n * @available ${method.availability}\n */\n`;
    }

    return `${jsDoc}${methodPrefix}${methodName}(${tsParams}): ${tsReturnType}`;
}

/**
 * Parse an Objective-C header definition and convert it to a TypeScript AST
 * @param headerDefinition The Objective-C header definition
 * @returns The TypeScript AST representation
 */
function parseObjCHeader(headerDefinition: string): ObjCMethod {
    // Split the input into documentation and method signature
    const docCommentMatch = headerDefinition.match(/\/\*!([\s\S]*?)\*\//);
    const methodSignatureMatch = headerDefinition.match(/\/\/\s*([+-][\s\S]*?;)/);

    if (!docCommentMatch || !methodSignatureMatch) {
        throw new Error("Invalid Objective-C header definition format");
    }

    const docComment = docCommentMatch[0];
    const methodSignature = methodSignatureMatch[1];

    // Parse documentation
    const { mainDoc, paramDocs, returnDoc } = parseDocumentation(docComment);

    // Parse method signature
    const methodInfo = parseMethodSignature(methodSignature);

    // Combine documentation with parameters
    const method: ObjCMethod = {
        ...methodInfo,
        documentation: mainDoc,
        returnDocumentation: returnDoc,
    };

    // Match parameter names with their documentation
    // First, extract all parameter names from the method signature
    const paramNames: string[] = [];
    const paramPattern = /(\w+):\s*\(([^)]+)\)\s*(\w+)/g;
    let match;

    // Reset the regex lastIndex
    paramPattern.lastIndex = 0;

    // Extract all parameter names from the method signature
    const methodSignatureStr = methodSignature.toString();
    while ((match = paramPattern.exec(methodSignatureStr)) !== null) {
        paramNames.push(match[3]); // The parameter name is in the third capture group
    }

    // Now match the parameter names with their documentation
    // The order of @param tags in the documentation should match the order in the method signature
    const paramDocKeys = Object.keys(paramDocs);

    // Assign documentation to parameters based on their position
    for (let i = 0; i < Math.min(paramNames.length, paramDocKeys.length); i++) {
        const paramName = paramNames[i];
        const docKey = paramDocKeys[i];

        // Find the parameter in the method's parameters array
        const param = method.parameters.find(p => p.name === paramName);
        if (param) {
            param.documentation = paramDocs[docKey];
        }
    }

    return method;
}

/**
 * Convert an ObjCClass to a TypeScript interface
 * @param objcClass The ObjCClass object
 * @returns A TypeScript interface as a string
 */
function convertClassToTypeScript(objcClass: ObjCClass): string {
    // Generate the interface header
    let tsInterface = `/**\n`;

    // Add class documentation
    if (objcClass.documentation) {
        tsInterface += ` * ${objcClass.documentation.replace(/\n/g, "\n * ")}\n *\n`;
    }

    // Add availability information
    if (objcClass.availability) {
        tsInterface += ` * @available ${objcClass.availability}\n`;
    }

    tsInterface += ` */\ninterface ${objcClass.name} {\n`;

    // Add properties
    for (const property of objcClass.properties) {
        // Add property documentation
        if (property.documentation) {
            tsInterface += `  /**\n`;
            tsInterface += `   * ${property.documentation.replace(/\n/g, "\n   * ")}\n`;
            tsInterface += `   */\n`;
        }

        // Add property declaration
        const tsType = convertTypeToTypeScript(property.type, property.isNullable);
        const readOnlyPrefix = property.isReadOnly ? "readonly " : "";

        // Avoid adding '| null' if the type already includes it
        const nullableSuffix = property.isNullable && !tsType.includes("| null") ? " | null" : "";

        tsInterface += `  ${readOnlyPrefix}${property.name}: ${tsType}${nullableSuffix};\n\n`;
    }

    // Separate instance methods and class methods
    const instanceMethods = objcClass.methods.filter(m => !m.isClassMethod);
    const classMethods = objcClass.methods.filter(m => m.isClassMethod);

    // Add instance methods
    for (const method of instanceMethods) {
        // Convert method to TypeScript
        const tsMethod = convertMethodToTypeScript(method);

        // Remove the 'static ' prefix for instance methods
        const methodDef = tsMethod.replace(/^static /, "");

        // Add the method definition
        tsInterface += `  ${methodDef};\n\n`;
    }

    tsInterface += `}\n\n`;

    // Add static methods as namespace
    if (classMethods.length > 0) {
        tsInterface += `/**\n * Static methods for ${objcClass.name}\n */\nnamespace ${objcClass.name} {\n`;

        for (const method of classMethods) {
            // Convert method to TypeScript
            const tsMethod = convertMethodToTypeScript(method);

            // Add the method definition (keep the static keyword)
            tsInterface += `  ${tsMethod};\n\n`;
        }

        tsInterface += `}\n`;
    }

    return tsInterface;
}

/**
 * Convert an ObjCClass to a TypeScript AST representation
 * @param objcClass The ObjCClass object
 * @returns A TypeScript AST representation
 */
function convertClassToTypeScriptAST(objcClass: ObjCClass): any {
    return {
        kind: "interface",
        name: objcClass.name,
        extends: objcClass.superclass !== "NSObject" ? [objcClass.superclass] : [],
        implements: objcClass.protocols,
        properties: objcClass.properties.map(prop => ({
            kind: "property",
            name: prop.name,
            type: convertTypeToTypeScript(prop.type, prop.isNullable),
            documentation: prop.documentation,
            isReadOnly: prop.isReadOnly,
            isOptional: prop.isNullable,
        })),
        methods: objcClass.methods.map(method => convertToTypeScriptAST(method)),
        documentation: objcClass.documentation,
        availability: objcClass.availability,
    };
}

/**
 * Convert an ObjCMethod to a TypeScript AST representation
 * @param method The ObjCMethod object
 * @returns A TypeScript AST representation
 */
function convertToTypeScriptAST(method: ObjCMethod): any {
    return {
        kind: "method",
        isStatic: method.isClassMethod,
        name: method.name,
        parameters: method.parameters.map(param => ({
            kind: "parameter",
            name: param.name,
            type: convertTypeToTypeScript(param.type, param.isNullable),
            documentation: param.documentation,
            isOptional: param.isNullable,
        })),
        returnType: convertTypeToTypeScript(method.returnType),
        documentation: method.documentation,
        returnDocumentation: method.returnDocumentation,
        availability: method.availability,
    };
}

/**
 * Parse an Objective-C property declaration
 * @param propertyDeclaration The property declaration to parse
 * @returns The parsed property information
 */
function parsePropertyDeclaration(
    propertyDeclaration: string,
): Omit<ObjCProperty, "documentation"> {
    try {
        // Clean up the declaration
        propertyDeclaration = propertyDeclaration.trim();
        if (propertyDeclaration.endsWith(";")) {
            propertyDeclaration = propertyDeclaration.slice(0, -1);
        }

        // First, extract the basic property declaration without macros
        // This regex captures the property declaration up to the first API_ macro
        const basicPropertyMatch = propertyDeclaration.match(
            /(@property\s*(?:\([^)]+\))?\s*[^;]+?)(?:\s+API_|\s*$)/,
        );
        if (!basicPropertyMatch) {
            throw new Error(
                `Failed to extract basic property declaration from: ${propertyDeclaration}`,
            );
        }

        const basicProperty = basicPropertyMatch[1].trim();

        // Extract property attributes
        const attributesMatch = basicProperty.match(/@property\s*\(([^)]+)\)/);
        const attributes = attributesMatch
            ? attributesMatch[1].split(",").map(attr => attr.trim())
            : [];

        // Determine if the property is read-only
        const isReadOnly = attributes.includes("readonly");

        // Remove the @property and attributes part to get just the type and name
        const typeAndName = basicProperty.replace(/@property\s*(?:\([^)]+\))?\s*/, "").trim();

        // Find the last word, which is the property name
        const nameMatch = typeAndName.match(/(\w+)$/);
        if (!nameMatch) {
            throw new Error(`Failed to extract property name from: ${typeAndName}`);
        }

        const name = nameMatch[1];

        // The type is everything before the name
        const typeWithAsterisk = typeAndName.substring(0, typeAndName.lastIndexOf(name)).trim();

        // Check if the type contains a pointer or nullable indicator
        const isNullable =
            typeWithAsterisk.includes("*") ||
            typeWithAsterisk.includes("nullable") ||
            typeWithAsterisk.includes("_Nullable");

        // Clean up the type
        const cleanType = typeWithAsterisk
            .replace("nullable", "")
            .replace("_Nullable", "")
            .replace("*", "")
            .trim();

        return {
            name,
            type: cleanType,
            isReadOnly,
            isNullable,
            attributes,
        };
    } catch (error) {
        console.warn(`Error parsing property declaration: ${propertyDeclaration}`);
        console.warn(error instanceof Error ? error.message : String(error));
        // Return a minimal property object with empty values
        return {
            name: "",
            type: "id",
            isReadOnly: false,
            isNullable: false,
            attributes: [],
        };
    }
}

/**
 * Parse an Objective-C class declaration
 * @param classDeclaration The class declaration to parse
 * @returns The parsed class information
 */
function parseClassDeclaration(
    classDeclaration: string,
): Omit<ObjCClass, "documentation" | "methods" | "properties"> {
    // Clean up the declaration
    classDeclaration = classDeclaration.trim();

    // Extract the class name, superclass, and protocols
    const classMatch = classDeclaration.match(/@interface\s+(\w+)\s*:\s*(\w+)(?:\s*<([^>]+)>)?/);

    if (!classMatch) {
        throw new Error(`Failed to parse class declaration: ${classDeclaration}`);
    }

    const className = classMatch[1];
    const superclass = classMatch[2];
    const protocolsStr = classMatch[3] || "";

    // Parse protocols
    const protocols = protocolsStr
        .split(",")
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // Extract availability information
    let availability = "";
    const availabilityMatch = classDeclaration.match(/API_AVAILABLE\(([^)]+)\)/);
    if (availabilityMatch) {
        availability = availabilityMatch[1];
        // Make sure the availability string has a closing parenthesis if needed
        if (availability.includes("(") && !availability.endsWith(")")) {
            availability += ")";
        }
    }

    return {
        name: className,
        superclass,
        protocols,
        availability,
    };
}

/**
 * Parse an Objective-C header file and extract class information
 * @param headerContent The content of the header file
 * @returns The parsed class information
 */
function parseObjCHeaderFile(headerContent: string): ObjCClass[] {
    // Split the header content into lines
    const lines = headerContent.split(/\r?\n/);

    // Store the parsed classes
    const classes: ObjCClass[] = [];

    // Current state
    let currentClass: Partial<ObjCClass> | null = null;
    let currentDocComment = "";
    let isInDocComment = false;
    let isInImplementation = false;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (line.length === 0) continue;

        // Handle documentation comments
        if (line.startsWith("/*!")) {
            isInDocComment = true;
            currentDocComment = line;
            continue;
        }

        if (isInDocComment) {
            currentDocComment += "\n" + line;
            if (line.includes("*/")) {
                isInDocComment = false;
            }
            continue;
        }

        // Handle class declarations
        if (line.startsWith("@interface")) {
            try {
                const classInfo = parseClassDeclaration(line);
                currentClass = {
                    ...classInfo,
                    documentation: "",
                    properties: [],
                    methods: [],
                };

                // Parse documentation if available
                if (currentDocComment) {
                    const { mainDoc } = parseDocumentation(currentDocComment);
                    currentClass.documentation = mainDoc;
                    currentDocComment = "";
                }
            } catch (error) {
                console.warn(`Failed to parse class declaration: ${line}`);
                console.warn(error instanceof Error ? error.message : String(error));
            }
            continue;
        }

        // Handle end of class declaration
        if (line.startsWith("@end")) {
            if (currentClass) {
                classes.push(currentClass as ObjCClass);
                currentClass = null;
            }
            continue;
        }

        // Handle implementation section (we skip this)
        if (line.startsWith("@implementation")) {
            isInImplementation = true;
            continue;
        }

        if (line.startsWith("@end") && isInImplementation) {
            isInImplementation = false;
            continue;
        }

        if (isInImplementation) {
            continue; // Skip implementation section
        }

        // If we're inside a class declaration, parse properties and methods
        if (currentClass) {
            // Handle property declarations
            if (line.startsWith("@property")) {
                try {
                    const propertyInfo = parsePropertyDeclaration(line);

                    // Parse documentation if available
                    let propertyDoc = "";
                    if (currentDocComment) {
                        const { mainDoc } = parseDocumentation(currentDocComment);
                        propertyDoc = mainDoc;
                        currentDocComment = "";
                    }

                    currentClass.properties = currentClass.properties || [];
                    currentClass.properties.push({
                        ...propertyInfo,
                        documentation: propertyDoc,
                    });
                } catch (error) {
                    console.warn(`Failed to parse property declaration: ${line}`);
                    console.warn(error instanceof Error ? error.message : String(error));
                }
                continue;
            }

            // Handle method declarations
            if (line.startsWith("+") || line.startsWith("-")) {
                // Method declarations can span multiple lines, so we need to collect them
                let methodDeclaration = line;
                let j = i + 1;

                // Continue collecting lines until we find a semicolon
                while (j < lines.length && !methodDeclaration.includes(";")) {
                    methodDeclaration += " " + lines[j].trim();
                    j++;
                }

                // Update the line index
                i = j - 1;

                try {
                    // Create a method signature with the comment format expected by parseObjCHeader
                    const methodSignature = `// ${methodDeclaration}`;
                    let methodInfo: ObjCMethod;

                    if (currentDocComment) {
                        // If we have a doc comment, use parseObjCHeader
                        const headerDef = `${currentDocComment}\n${methodSignature}`;
                        methodInfo = parseObjCHeader(headerDef);
                        currentDocComment = "";
                    } else {
                        // Otherwise, just parse the method signature
                        const methodBase = parseMethodSignature(methodDeclaration);
                        methodInfo = {
                            ...methodBase,
                            documentation: "",
                            returnDocumentation: "",
                        };
                    }

                    currentClass.methods = currentClass.methods || [];
                    currentClass.methods.push(methodInfo);
                } catch (error) {
                    console.warn(`Failed to parse method declaration: ${methodDeclaration}`);
                    console.warn(error instanceof Error ? error.message : String(error));
                }
                continue;
            }
        }
    }

    return classes;
}

function main() {
    try {
        // Check if a file path was provided as a command-line argument
        const args = Deno.args;
        let inputContent = "";
        let parseMode = "class"; // Default to class parsing
        let inputPath = "";

        if (args.length > 0) {
            // Check for parse mode
            if (args[0] === "--mode" && args.length > 1) {
                parseMode = args[1];
                args.splice(0, 2); // Remove the mode arguments
            }

            // If a file path is provided, read the file
            if (args[0] === "--file" && args.length > 1) {
                inputPath = args[1];
            }
            // If a string is provided directly
            else if (args[0] === "--string" && args.length > 1) {
                inputContent = args[1];
                inputPath = ""; // Clear the input path since we're using a string
            }
            // If --help is provided, show usage information
            else if (args[0] === "--help") {
                console.log("Usage:");
                console.log("  deno run --allow-read scripts/generate-ts-api.ts [options]");
                console.log("\nOptions:");
                console.log(
                    '  --mode <mode>    Parse mode: "method" or "class" (default: "class")',
                );
                console.log("  --file <path>    Parse Objective-C header from a file");
                console.log("  --string <text>  Parse Objective-C header from a string");
                console.log("  --help           Show this help message");
                console.log("\nExamples:");
                console.log(
                    "  deno run --allow-read scripts/generate-ts-api.ts --mode method --file ./headers/NSButton.h",
                );
                console.log(
                    "  deno run --allow-read scripts/generate-ts-api.ts --mode class --file ./headers/NSButton.h",
                );
                return;
            }
            // If no option is provided, assume the first argument is a file path
            else {
                inputPath = args[0];
            }
        }

        // If no input path is provided, use a default
        if (!inputPath) {
            inputPath =
                "/Applications/Xcode-16.2.0.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks/AppKit.framework/Versions/C/Headers/NSButton.h";
        }

        // Read from file if inputContent is empty and inputPath is provided
        if (!inputContent && inputPath) {
            try {
                console.log(`Reading from file: ${inputPath}`);
                inputContent = Deno.readTextFileSync(inputPath);
            } catch (error) {
                console.error(`Error reading file ${inputPath}:`, error);
                return;
            }
        }

        // Ensure we have content to parse
        if (!inputContent) {
            console.error("No input content provided. Use --file or --string options.");
            return;
        }

        const project = new Project();

        // Parse based on the selected mode
        if (parseMode === "class") {
            // Parse the entire header file
            console.log("Parsing header file...");
            const classes = parseObjCHeaderFile(inputContent);
            console.log(`Found ${classes.length} classes.`);

            for (const c of classes) {
                // Create a new source file for each class
                const filePath = `./src/generated/${c.name}.ts`;
                console.log(`Creating file: ${filePath}`);
                const sourceFile = project.createSourceFile(filePath, "", { overwrite: true });

                // Add imports
                sourceFile.addImportDeclaration({
                    defaultImport: "objc",
                    moduleSpecifier: "objc",
                });

                sourceFile.addImportDeclaration({
                    namedImports: ["id"],
                    moduleSpecifier: "../objc.ts",
                });

                // Add parent class import if needed
                if (c.superclass) {
                    sourceFile.addImportDeclaration({
                        namedImports: [c.superclass],
                        moduleSpecifier: `./${c.superclass}.ts`,
                    });
                }

                // Create the class
                const classDeclaration = sourceFile.addClass({
                    name: c.name,
                    isExported: true,
                    extends: c.superclass ? c.superclass : undefined,
                });

                // Add static class reference
                classDeclaration.addProperty({
                    name: "Class",
                    type: undefined,
                    initializer: `objc.classes["${c.name}"]`,
                    isStatic: true,
                    isReadonly: true,
                    scope: Scope.Private,
                });

                // Add pointer property
                classDeclaration.addProperty({
                    name: "pointer",
                    type: "id",
                    scope: Scope.Protected,
                });

                // Process properties
                for (const property of c.properties) {
                    try {
                        // Skip properties that failed to parse correctly
                        if (!property.name) continue;

                        // Convert property type to TypeScript
                        const tsType = convertObjCTypeToTypeScriptString(property.type);

                        // Create getter
                        const getterName = property.name;
                        const getter = classDeclaration.addGetAccessor({
                            name: getterName,
                            scope: Scope.Public,
                            returnType: tsType,
                        });

                        getter.setBodyText(`return objc.msgSend(this.pointer, "${getterName}");`);

                        // Create setter if property is not read-only
                        if (!property.isReadOnly) {
                            const setter = classDeclaration.addSetAccessor({
                                name: getterName,
                                scope: Scope.Public,
                                parameters: [
                                    {
                                        name: "value",
                                        type: tsType,
                                    },
                                ],
                            });

                            // Objective-C setter method name is "setPropertyName:"
                            const setterMethodName = `set${getterName
                                .charAt(0)
                                .toUpperCase()}${getterName.slice(1)}:`;
                            setter.setBodyText(
                                `objc.msgSend(this.pointer, "${setterMethodName}", value);`,
                            );
                        }
                    } catch (error) {
                        console.warn(`Failed to process property: ${property.name}`);
                        console.warn(error instanceof Error ? error.message : String(error));
                    }
                }

                // Add constructor
                const constructor = classDeclaration.addConstructor({
                    scope: Scope.Public,
                });

                constructor.setBodyText(writer => {
                    writer
                        .writeLine("super();")
                        .writeLine(
                            `this.pointer = objc.msgSend(objc.msgSend(${c.name}.Class, "alloc"), "init");`,
                        );
                });

                // Process methods
                // First, group methods by base name and static/instance status
                const methodGroups: Record<string, ObjCMethod[]> = {};

                for (const method of c.methods) {
                    // Skip initializers as we handle them in the constructor
                    if (method.name.startsWith("init")) continue;

                    const isClassMethod = method.isClassMethod;
                    const methodKey = `${isClassMethod ? "static_" : ""}${
                        method.name.split(":")[0]
                    }`;

                    if (!methodGroups[methodKey]) {
                        methodGroups[methodKey] = [];
                    }

                    methodGroups[methodKey].push(method);
                }

                // Process each method group
                for (const [methodKey, methods] of Object.entries(methodGroups)) {
                    const isClassMethod = methodKey.startsWith("static_");
                    const baseMethodName = methodKey.replace("static_", "");

                    // Check if this is a setter method
                    const firstMethod = methods[0];
                    const isSetterMethod =
                        firstMethod.name.startsWith("set") &&
                        firstMethod.parameters.length === 1 &&
                        firstMethod.name.length > 4 && // "set" + at least one char + ":"
                        firstMethod.name.charAt(3) === firstMethod.name.charAt(3).toUpperCase() &&
                        firstMethod.name.endsWith(":");

                    if (isSetterMethod) {
                        // Create setter method
                        let propertyName = "";
                        if (firstMethod.name.startsWith("set")) {
                            // Standard setter: setPropertyName:
                            propertyName = firstMethod.name.substring(
                                3,
                                firstMethod.name.length - 1,
                            );
                            propertyName =
                                propertyName.charAt(0).toLowerCase() + propertyName.slice(1);
                        } else {
                            // Method ending with colon: propertyName:
                            propertyName = firstMethod.name.substring(
                                0,
                                firstMethod.name.length - 1,
                            );
                        }

                        // Replace any colons in the property name with underscores
                        propertyName = propertyName.replace(/:/g, "_");

                        // Skip if we've already created a setter for this property
                        if (classDeclaration.getSetAccessor(propertyName)) {
                            continue;
                        }

                        const setter = classDeclaration.addSetAccessor({
                            name: propertyName,
                            scope: Scope.Public,
                            parameters: [
                                {
                                    name: "value",
                                    type: convertObjCTypeToTypeScriptString(
                                        firstMethod.parameters[0].type,
                                    ),
                                },
                            ],
                        });

                        setter.setBodyText(
                            `objc.msgSend(this.pointer, "${firstMethod.name}", value);`,
                        );
                    } else if (methods.length > 1) {
                        // Multiple methods with the same base name - create overloads

                        // For overloaded methods, we need to create separate method declarations for each overload
                        // followed by the implementation method

                        // First, add all the overload signatures
                        for (const overloadMethod of methods) {
                            // Create a method declaration for each overload signature
                            const overloadSignature = classDeclaration.addMethod({
                                name: baseMethodName,
                                scope: Scope.Public,
                                isStatic: isClassMethod,
                                returnType: convertObjCTypeToTypeScriptString(
                                    overloadMethod.returnType,
                                ),
                                // This is a declaration only, no implementation
                            });

                            // Add parameters based on the number of parameters
                            if (overloadMethod.parameters.length === 0) {
                                // No parameters, leave empty
                            } else if (overloadMethod.parameters.length === 1) {
                                // Single parameter, use direct parameter
                                const param = overloadMethod.parameters[0];
                                overloadSignature.addParameter({
                                    name: param.name,
                                    type: convertObjCTypeToTypeScriptString(param.type),
                                    hasQuestionToken: param.isNullable,
                                });
                            } else {
                                // Multiple parameters, use a single object parameter with destructuring
                                const parameterTypes = overloadMethod.parameters.map(param => {
                                    return {
                                        name: param.name,
                                        type: convertObjCTypeToTypeScriptString(param.type),
                                        hasQuestionToken: param.isNullable,
                                    };
                                });

                                // Create a structured type for the parameters
                                const paramStructure = `{ ${parameterTypes
                                    .map(
                                        p => `${p.name}${p.hasQuestionToken ? "?" : ""}: ${p.type}`,
                                    )
                                    .join(", ")} }`;

                                overloadSignature.addParameter({
                                    name: "params",
                                    type: paramStructure,
                                });
                            }

                            // Set the body to be empty since this is just a signature
                            overloadSignature.removeBody();
                        }

                        // Now add the implementation method
                        const implementationMethod = classDeclaration.addMethod({
                            name: baseMethodName,
                            scope: Scope.Public,
                            isStatic: isClassMethod,
                            returnType: "any", // Use 'any' for the implementation
                        });

                        // Add parameter for each possible signature
                        for (const overloadMethod of methods) {
                            if (overloadMethod.parameters.length === 0) {
                                // No parameters case
                            } else if (overloadMethod.parameters.length === 1) {
                                // Single parameter case
                                const param = overloadMethod.parameters[0];
                                const paramType = convertObjCTypeToTypeScriptString(param.type);

                                implementationMethod.addParameter({
                                    name: param.name,
                                    type: paramType,
                                    hasQuestionToken: true,
                                });
                            } else {
                                // Multiple parameters case
                                // Add all parameters as optional
                                for (const param of overloadMethod.parameters) {
                                    // Only add if not already added
                                    if (
                                        !implementationMethod
                                            .getParameters()
                                            .some(p => p.getName() === param.name)
                                    ) {
                                        implementationMethod.addParameter({
                                            name: param.name,
                                            type: convertObjCTypeToTypeScriptString(param.type),
                                            hasQuestionToken: true,
                                        });
                                    }
                                }
                            }
                        }

                        // Add a rest parameter to capture all arguments
                        implementationMethod.addParameter({
                            name: "args",
                            isRestParameter: true,
                            type: "any[]",
                        });

                        // Implement the method body with logic to call the correct Objective-C method
                        implementationMethod.setBodyText(writer => {
                            const target = isClassMethod ? `${c.name}.Class` : "this.pointer";

                            writer.writeLine(
                                "// Determine which method to call based on arguments",
                            );

                            // Start with a variable to hold all arguments
                            writer.writeLine("const allArgs = [...args];");

                            // Add named parameters to allArgs if they exist
                            const namedParams = implementationMethod
                                .getParameters()
                                .filter(p => !p.isRestParameter())
                                .map(p => p.getName());

                            if (namedParams.length > 0) {
                                writer.writeLine(
                                    `// Add named parameters to args array if they exist`,
                                );
                                for (const paramName of namedParams) {
                                    writer.writeLine(
                                        `if (${paramName} !== undefined) allArgs.unshift(${paramName});`,
                                    );
                                }
                            }

                            // Create conditions for each method overload
                            let isFirst = true;
                            for (const overloadMethod of methods) {
                                const condition =
                                    overloadMethod.parameters.length === 0
                                        ? "allArgs.length === 0"
                                        : `allArgs.length === ${overloadMethod.parameters.length}`;

                                const methodNameWithColons = overloadMethod.name.includes(":")
                                    ? overloadMethod.name
                                    : overloadMethod.name +
                                      ":".repeat(overloadMethod.parameters.length);

                                if (isFirst) {
                                    writer.writeLine(`if (${condition}) {`);
                                    isFirst = false;
                                } else {
                                    writer.writeLine(`else if (${condition}) {`);
                                }

                                writer.writeLine(
                                    `  return objc.msgSend(${target}, "${methodNameWithColons}", ...allArgs);`,
                                );
                                writer.writeLine("}");
                            }

                            // Add a fallback case
                            writer.writeLine("else {");
                            writer.writeLine(
                                `  throw new Error("Invalid number of arguments for method ${baseMethodName}");`,
                            );
                            writer.writeLine("}");
                        });
                    } else {
                        // Regular method (not an overload)
                        const methodName = firstMethod.name.split(":")[0];

                        const methodDeclaration = classDeclaration.addMethod({
                            name: methodName,
                            scope: Scope.Public,
                            isStatic: isClassMethod,
                            returnType: convertObjCTypeToTypeScriptString(firstMethod.returnType),
                        });

                        // Add parameters
                        firstMethod.parameters.forEach(param => {
                            methodDeclaration.addParameter({
                                name: param.name,
                                type: convertObjCTypeToTypeScriptString(param.type),
                                hasQuestionToken: param.isNullable,
                            });
                        });

                        methodDeclaration.setBodyText(writer => {
                            const target = isClassMethod ? `${c.name}.Class` : "this.pointer";

                            if (firstMethod.parameters.length === 0) {
                                writer.writeLine(
                                    `return objc.msgSend(${target}, "${firstMethod.name}");`,
                                );
                            } else {
                                // Build the method name with colons for each parameter
                                const methodNameWithColons = firstMethod.name.includes(":")
                                    ? firstMethod.name
                                    : firstMethod.name + ":".repeat(firstMethod.parameters.length);

                                // Build the parameter list
                                const paramList = firstMethod.parameters
                                    .map(p => p.name)
                                    .join(", ");

                                writer.writeLine(
                                    `return objc.msgSend(${target}, "${methodNameWithColons}", ${paramList});`,
                                );
                            }
                        });
                    }
                }

                console.log(`Generated ${c.name}.ts`);
            }

            // Post-process the files to fix any formatting issues
            console.log("Post-processing files...");
            for (const c of classes) {
                const filePath = `./src/generated/${c.name}.ts`;
                // Post-process the files to fix any formatting issues
                console.log("Post-processing files...");
                for (const c of classes) {
                    const filePath = `./src/generated/${c.name}.ts`;
                    try {
                        // Read the generated file
                        let fileContent = Deno.readTextFileSync(filePath);

                        // Group methods by base name and static/instance status
                        const methodGroups: Record<string, ObjCMethod[]> = {};
                        for (const method of c.methods) {
                            if (method.name.startsWith("init")) continue;

                            const isClassMethod = method.isClassMethod;
                            const baseMethodName = method.name.split(":")[0];
                            const methodKey = `${isClassMethod ? "static_" : ""}${baseMethodName}`;

                            if (!methodGroups[methodKey]) {
                                methodGroups[methodKey] = [];
                            }

                            methodGroups[methodKey].push(method);
                        }

                        // Process each method group with multiple methods (overloads)
                        for (const [methodKey, methods] of Object.entries(methodGroups)) {
                            if (methods.length <= 1) continue;

                            const isClassMethod = methodKey.startsWith("static_");
                            const baseMethodName = methodKey.replace("static_", "");

                            // Find all overload signatures and the implementation in the file
                            const overloadRegex = new RegExp(
                                `(\\s+)(public ${
                                    isClassMethod ? "static " : ""
                                }${baseMethodName}\\([^)]*\\): [^;]+;)`,
                                "g",
                            );

                            const implementationRegex = new RegExp(
                                `(\\s+)(public ${
                                    isClassMethod ? "static " : ""
                                }${baseMethodName}\\([^{]*\\{)`,
                                "g",
                            );

                            // Find all matches
                            const overloadMatches: string[] = [];
                            let matchResult;
                            while ((matchResult = overloadRegex.exec(fileContent)) !== null) {
                                overloadMatches.push(matchResult[0]);
                            }

                            // Find the implementation
                            const implementationMatch = implementationRegex.exec(fileContent);
                            if (!implementationMatch) continue;

                            // Remove all overload signatures from the file
                            for (const overload of overloadMatches) {
                                fileContent = fileContent.replace(overload, "");
                            }

                            // Insert all overload signatures before the implementation
                            if (implementationMatch && overloadMatches.length > 0) {
                                const implementation = implementationMatch[0];
                                const overloadsText = overloadMatches.join("\n");

                                fileContent = fileContent.replace(
                                    implementation,
                                    `${overloadsText}\n${implementation}`,
                                );
                            }
                        }

                        // Fix missing method declarations
                        // Look for patterns like:
                        // /**
                        //  * @overload methodName...
                        //  */
                        //     // Add named parameters...
                        const missingMethodRegex =
                            /\/\*\*\s*\n\s*\*\s*@overload\s+(\w+)(?:\([^)]*\)):[^*]*\*\/\s*\n\s*\/\/\s*Add named parameters/g;

                        let missingMethodMatch;
                        while (
                            (missingMethodMatch = missingMethodRegex.exec(fileContent)) !== null
                        ) {
                            const methodName = missingMethodMatch[1];
                            const isStatic = fileContent
                                .substring(missingMethodMatch.index - 50, missingMethodMatch.index)
                                .includes("static");

                            // Find the end of the JSDoc comment
                            const commentEndIndex =
                                fileContent.indexOf("*/", missingMethodMatch.index) + 2;

                            // Insert the method declaration after the JSDoc comment
                            const methodDeclaration = `\n    public ${
                                isStatic ? "static " : ""
                            }${methodName}(name?: id, description?: id, value?: number, ...args: any[]): any {\n`;
                            fileContent =
                                fileContent.substring(0, commentEndIndex) +
                                methodDeclaration +
                                fileContent.substring(commentEndIndex);
                        }

                        // Write the modified content back to the file
                        Deno.writeTextFileSync(filePath, fileContent);
                        console.log(`Post-processed ${c.name}.ts`);
                    } catch (error) {
                        console.warn(`Error post-processing file ${filePath}:`, error);
                    }
                }

                console.log("Files post-processed successfully!");
            }
        } else {
            // Parse a single method
            const method = parseObjCHeader(inputContent);

            // Output only the AST as JSON
            const ast = convertToTypeScriptAST(method);
            console.log(JSON.stringify(ast, null, 2));
        }
    } catch (error: unknown) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
    }
}

import { Project, Scope } from "npm:ts-morph";

// Run the script if executed directly
if (import.meta.main) {
    main();
}

// Helper function to convert ObjC types to TypeScript type strings
function convertObjCTypeToTypeScriptString(objcType: string): string {
    if (!objcType) {
        return "void";
    }

    const typeMap: Record<string, string> = {
        void: "void",
        BOOL: "boolean",
        NSInteger: "number",
        NSUInteger: "number",
        CGFloat: "number",
        double: "number",
        float: "number",
        int: "number",
        "NSString*": "string",
        id: "id",
    };

    // Handle nullable types
    const isNullable = objcType.includes("nullable") || objcType.includes("_Nullable");
    let cleanType = objcType.replace("nullable", "").replace("_Nullable", "").trim();

    // Handle pointer types
    if (cleanType.endsWith("*")) {
        cleanType = cleanType.substring(0, cleanType.length - 1);
    }

    let tsType = typeMap[cleanType];

    if (!tsType) {
        // If it's a custom class type, use id
        tsType = "id";
    }

    // Make nullable if needed
    if (isNullable) {
        return `${tsType} | null`;
    }

    return tsType;
}

// Export functions for use in other modules
export {
    parseObjCHeader,
    parseObjCHeaderFile,
    convertToTypeScriptAST,
    convertClassToTypeScriptAST,
    convertMethodToTypeScript,
    convertClassToTypeScript,
    type ObjCMethod,
    type ObjCParameter,
    type ObjCProperty,
    type ObjCClass,
};
