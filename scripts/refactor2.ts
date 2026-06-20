import { Project, SyntaxKind, ObjectLiteralExpression } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const graphqlFile = project.getSourceFile("src/lib/graphql.ts");
const exportedFunctions = graphqlFile!.getFunctions().filter(f => f.isExported());
const queryNames = exportedFunctions.map(f => f.getName()!);

const sourceFiles = project.getSourceFiles();

for (const sourceFile of sourceFiles) {
  if (sourceFile.getFilePath().includes("src/lib/graphql.ts")) continue;
  if (sourceFile.getFilePath().includes("src/constants.ts")) continue;
  
  let modified = false;

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  let needsAppConfig = false;
  
  for (const call of calls) {
    const expr = call.getExpression();
    if (queryNames.includes(expr.getText())) {
      // It's a call to a graphql function. We must append `config.network`.
      call.addArgument("config.network");
      needsAppConfig = true;
      modified = true;
    }
  }

  // Also replace SUBSCRIPTION_DEVNET_PACKAGE_ID with config.PACKAGE_ID
  const identNodes = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  for (const ident of identNodes) {
    if (ident.getText() === "SUBSCRIPTION_DEVNET_PACKAGE_ID") {
      ident.replaceWithText("config.PACKAGE_ID");
      needsAppConfig = true;
      modified = true;
    }
  }

  // Also replace any useQuery `queryKey` that doesn't have network in it.
  if (needsAppConfig) {
    const useQueryCalls = calls.filter(c => c.getExpression().getText() === "useQuery");
    for (const c of useQueryCalls) {
      const obj = c.getArguments()[0] as ObjectLiteralExpression;
      if (obj && obj.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const queryKeyProp = obj.getProperty("queryKey");
        if (queryKeyProp && queryKeyProp.getKind() === SyntaxKind.PropertyAssignment) {
          const arrExpr = queryKeyProp.getFirstChildByKind(SyntaxKind.ArrayLiteralExpression);
          if (arrExpr) {
            const hasNetwork = arrExpr.getElements().some(e => e.getText().includes("network"));
            if (!hasNetwork) {
              arrExpr.addElement("config.network");
              modified = true;
            }
          }
        }
      }
    }
  }

  if (modified && needsAppConfig) {
    // Add useAppConfig import
    const hasAppConfig = sourceFile.getImportDeclaration(d => d.getModuleSpecifierValue().includes("useAppConfig"));
    if (!hasAppConfig) {
      const depth = sourceFile.getFilePath().split("/").length - 7; 
      const prefix = depth > 0 ? "../".repeat(depth) : "./";
      sourceFile.addImportDeclaration({
        namedImports: ["useAppConfig"],
        moduleSpecifier: `${prefix}hooks/useAppConfig`
      });
    }

    // Now insert `const config = useAppConfig();` at the beginning of the component or hook.
    // We look for exported functions that are React components or hooks (start with use or uppercase)
    const funcs = sourceFile.getFunctions();
    for (const func of funcs) {
      const name = func.getName() || "";
      if (name.startsWith("use") || /^[A-Z]/.test(name)) {
        if (!func.getBodyText()?.includes("useAppConfig")) {
           func.insertStatements(0, "const config = useAppConfig();");
        }
      }
    }
    // Also handle const components defined with arrow functions
    const varDecls = sourceFile.getVariableDeclarations();
    for (const decl of varDecls) {
      const name = decl.getName();
      if (name.startsWith("use") || /^[A-Z]/.test(name)) {
        const init = decl.getInitializer();
        if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
          const body = init.getBody();
          if (body.getKind() === SyntaxKind.Block) {
             if (!body.getText().includes("useAppConfig")) {
                 body.insertStatements(0, "const config = useAppConfig();");
             }
          }
        }
      }
    }
  }
}

project.saveSync();
console.log("AST Refactor Done");
