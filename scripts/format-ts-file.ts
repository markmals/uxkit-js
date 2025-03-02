import {
    Project,
    SourceFile,
    MethodDeclaration,
    ClassDeclaration,
    IndentationText,
    NewLineKind,
    SyntaxKind,
} from "npm:ts-morph";

/**
 * Groups method overloads and their implementations in a TypeScript file.
 *
 * @param fileContent The content of the TypeScript file to process
 * @returns The processed file content with grouped method overloads
 */
export function groupMethodOverloads(fileContent: string): string {
    // Create a new project
    const project = new Project({
        useInMemoryFileSystem: true,
        manipulationSettings: {
            indentationText: IndentationText.FourSpaces,
            newLineKind: NewLineKind.LineFeed,
        },
    });

    // Add the source file to the project
    const sourceFile = project.createSourceFile("temp.ts", fileContent, { overwrite: true });

    // Process the source file
    processSourceFile(sourceFile);

    // Return the processed content
    return sourceFile.getFullText();
}

/**
 * Process a source file to group method overloads
 *
 * @param sourceFile The source file to process
 */
function processSourceFile(sourceFile: SourceFile): void {
    // Process each class in the source file
    sourceFile.getClasses().forEach(classDeclaration => {
        // Get all methods in the class
        const methods = classDeclaration.getMethods();

        // Group methods by name and static status
        const methodGroups = new Map<string, MethodDeclaration[]>();

        methods.forEach(method => {
            // Skip getters, setters, and constructors
            if (
                method.getFirstDescendantByKind(SyntaxKind.GetKeyword) ||
                method.getFirstDescendantByKind(SyntaxKind.SetKeyword) ||
                method.getName() === "constructor"
            ) {
                return;
            }

            const isStatic = method.isStatic();
            const name = method.getName();
            const key = `${isStatic ? "static_" : ""}${name}`;

            if (!methodGroups.has(key)) {
                methodGroups.set(key, []);
            }

            methodGroups.get(key)!.push(method);
        });

        // Process each method group
        methodGroups.forEach((methodGroup, key) => {
            // Skip if there's only one method in the group
            if (methodGroup.length <= 1) {
                return;
            }

            // Find signatures and implementations
            const signatures = methodGroup.filter(m => !m.getBody());
            const implementations = methodGroup.filter(m => m.getBody());

            // Skip if there's no implementation or no signatures
            if (implementations.length !== 1 || signatures.length === 0) {
                return;
            }

            const implementation = implementations[0];

            // Get the text of all methods
            const signatureTexts = signatures.map(s => s.getText());
            const implementationText = implementation.getText();

            // Create the combined text
            const combinedText = [...signatureTexts, implementationText].join("\n");

            // Find the position of the first method in the group
            const sortedMethods = [...methodGroup].sort(
                (a, b) => a.getStartLineNumber() - b.getStartLineNumber(),
            );

            const firstMethod = sortedMethods[0];

            // Replace the first method with the combined text
            firstMethod.replaceWithText(combinedText);

            // Remove all other methods in the group
            methodGroup.forEach(method => {
                if (method !== firstMethod) {
                    method.remove();
                }
            });
        });
    });
}

/**
 * Process a TypeScript file to group method overloads
 *
 * @param filePath The path to the TypeScript file to process
 */
export async function processFile(filePath: string): Promise<void> {
    try {
        // Read the file
        const fileContent = await Deno.readTextFile(filePath);

        // Process the content
        const processedContent = groupMethodOverloads(fileContent);

        // Write the processed content back to the file
        await Deno.writeTextFile(filePath, processedContent);

        console.log(`Successfully processed ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

/**
 * Process all TypeScript files in a directory
 *
 * @param directoryPath The path to the directory containing TypeScript files
 */
export async function processDirectory(directoryPath: string): Promise<void> {
    try {
        // Read all entries in the directory
        const entries = await Deno.readDir(directoryPath);

        // Process each entry
        for await (const entry of entries) {
            const entryPath = `${directoryPath}/${entry.name}`;

            if (entry.isDirectory) {
                // Recursively process subdirectories
                await processDirectory(entryPath);
            } else if (entry.isFile && entry.name.endsWith(".ts")) {
                // Process TypeScript files
                await processFile(entryPath);
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${directoryPath}:`, error);
    }
}

// Main function to run the script
async function main() {
    const args = Deno.args;

    if (args.length === 0) {
        console.log("Usage:");
        console.log(
            "  deno run --allow-read --allow-write --allow-env --allow-sys scripts/format-ts-file.ts <file_or_directory_path>",
        );
        return;
    }

    const path = args[0];

    try {
        const stat = await Deno.stat(path);

        if (stat.isDirectory) {
            await processDirectory(path);
        } else if (stat.isFile) {
            await processFile(path);
        } else {
            console.error(`${path} is neither a file nor a directory`);
        }
    } catch (error) {
        console.error(`Error processing ${path}:`, error);
    }
}

// Run the script if executed directly
if (import.meta.main) {
    main();
}
