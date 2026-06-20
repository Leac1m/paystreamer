import { Project, SyntaxKind, ObjectLiteralExpression } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles();

const graphqlFuncs = [
  "queryAccountCreatedEvents",
  "queryRecentEventsByType",
  "queryPlatform",
  "queryPlatformsByOwner",
  "queryPaymentProcessedEvents",
  "queryPaymentFailedEvents",
  "queryDepositEvents",
  "querySubscriptionCreatedEvents",
  "querySubscriptionUpdatedEvents",
  "querySubscriptionCreatedEventsByPlatform",
  "querySubscriptionUpdatedEventsByPlatform",
  "queryPlatformInitialVersions"
];

for (const sf of sourceFiles) {
  if (sf.getFilePath().includes("src/lib/graphql.ts")) continue;
  if (sf.getFilePath().includes("src/constants.ts")) continue;
  if (sf.getFilePath().includes("src/dApp-kit.ts")) continue;
  
  let modified = false;

  // Replace graphql calls
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (graphqlFuncs.includes(expr.getText())) {
      // It's a call to a graphql function. We must append `config.network`.
      call.addArgument("config.network");
      modified = true;
    }
  }

  // Replace SUBSCRIPTION_DEVNET_PACKAGE_ID
  const idents = sf.getDescendantsOfKind(SyntaxKind.Identifier);
  for (const ident of idents) {
    if (ident.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;
    if (ident.getText() === "SUBSCRIPTION_DEVNET_PACKAGE_ID" || ident.getText() === "V3_PACKAGE_ID") {
      ident.replaceWithText("config.PACKAGE_ID");
      modified = true;
    }
  }

  if (modified) {
    // Add useAppConfig import
    const hasAppConfig = sf.getImportDeclaration(d => d.getModuleSpecifierValue().includes("useAppConfig"));
    if (!hasAppConfig) {
      const depth = sf.getFilePath().split("/").length - 7; // src is at depth 6
      const prefix = depth > 0 ? "../".repeat(depth) : "./";
      sf.addImportDeclaration({
        namedImports: ["useAppConfig"],
        moduleSpecifier: `${prefix}hooks/useAppConfig`
      });
    }

    // Add `const config = useAppConfig();` at the top of React components
    const funcs = sf.getFunctions();
    for (const func of funcs) {
      const name = func.getName() || "";
      if (name.startsWith("use") || /^[A-Z]/.test(name)) {
        if (!func.getBodyText()?.includes("useAppConfig()")) {
           func.insertStatements(0, "const config = useAppConfig();");
        }
      }
    }

    // Add queryKey `config.network`
    const useQueryCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => c.getExpression().getText() === "useQuery");
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
            }
          }
        }
      }
    }
  }
}

project.saveSync();
console.log("Refactored React components");
