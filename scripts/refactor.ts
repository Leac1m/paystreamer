import { Project, SyntaxKind, CallExpression } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const graphqlFile = project.getSourceFile("src/lib/graphql.ts");
if (!graphqlFile) throw new Error("Could not find graphql.ts");

// 1. Add NetworkConfig import to graphql.ts if missing
const importDecl = graphqlFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "../constants");
if (importDecl) {
  const namedImports = importDecl.getNamedImports().map(i => i.getName());
  if (!namedImports.includes("NetworkConfig")) {
    importDecl.addNamedImport("NetworkConfig");
  }
}

// 2. Modify executeQuery
const executeQueryFn = graphqlFile.getFunction("executeQuery");
if (executeQueryFn) {
  executeQueryFn.insertParameter(0, { name: "config", type: "NetworkConfig" });
  
  // replace graphqlClient with dynamic instantiation
  const body = executeQueryFn.getBodyText() || "";
  const newBody = `
  const client = new SuiGraphQLClient({
    url: config.GRAPHQL_URL,
    network: config.GRAPHQL_URL.includes("devnet") ? "devnet" : "testnet"
  });
  const result = await client.query({ query, variables });
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }
  return (result.data || {}) as T;
  `;
  executeQueryFn.setBodyText(newBody);
}

// 3. Update all exported query functions in graphql.ts
const exportedFunctions = graphqlFile.getFunctions().filter(f => f.isExported());
const queryNames = exportedFunctions.map(f => f.getName()!);

for (const fn of exportedFunctions) {
  fn.insertParameter(0, { name: "config", type: "NetworkConfig" });
  
  // update executeQuery calls inside the function
  const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    if (call.getExpression().getText() === "executeQuery") {
      call.insertArgument(0, "config");
    }
  }

  // replace SUBSCRIPTION_DEVNET_PACKAGE_ID with config.PACKAGE_ID
  const text = fn.getBodyText() || "";
  fn.setBodyText(text.replace(/SUBSCRIPTION_DEVNET_PACKAGE_ID/g, "config.PACKAGE_ID"));
}

// 4. Update callers of these functions
const sourceFiles = project.getSourceFiles();

for (const sourceFile of sourceFiles) {
  if (sourceFile.getFilePath().includes("src/lib/graphql.ts")) continue;
  
  let modified = false;

  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  let needsAppConfig = false;
  
  for (const call of calls) {
    const expr = call.getExpression();
    if (queryNames.includes(expr.getText())) {
      // In React components (hooks like useQuery), we assume `config` is available.
      // Wait, is it inside a React component?
      // For now, insert `config`
      call.insertArgument(0, "config");
      needsAppConfig = true;
      modified = true;
    }
  }

  if (needsAppConfig) {
    // Add useAppConfig import
    const hasAppConfig = sourceFile.getImportDeclaration(d => d.getModuleSpecifierValue() === "../../hooks/useAppConfig" || d.getModuleSpecifierValue() === "../hooks/useAppConfig");
    if (!hasAppConfig) {
      // rough heuristic for path depth
      const depth = sourceFile.getFilePath().split("/").length - 7; // src is at depth 6
      const prefix = depth > 0 ? "../".repeat(depth) : "./";
      sourceFile.addImportDeclaration({
        namedImports: ["useAppConfig"],
        moduleSpecifier: `${prefix}hooks/useAppConfig`
      });
    }

    // Insert const config = useAppConfig(); at the top of the hook if it's a react component
    // We'll look for functions that return a useQuery call, or are React components.
    // For simplicity, we can do this manually for the 15 files or inject it into the functions that call the query.
  }
}

project.saveSync();
console.log("Refactoring complete");
