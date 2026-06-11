"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var graphql_1 = require("@mysten/sui/graphql");
var ed25519_1 = require("@mysten/sui/keypairs/ed25519");
var transactions_1 = require("@mysten/sui/transactions");
var constants_ts_1 = require("../src/constants.ts");
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// This is the keypair for the demo scheduler.
// It will be loaded from the secure .env file.
var SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;
// Define the network
var client = new graphql_1.SuiGraphQLClient({ url: "https://fullnode.devnet.sui.io:443/graphql", network: "devnet" });
function runScheduler() {
    return __awaiter(this, void 0, void 0, function () {
        var keypair, schedulerAddress, hasNextPage, cursor, accountIds_1, result, events, accountsResult, duePayments, now, _i, accountsResult_1, acc, accContent, subscriptions, _a, subscriptions_1, subEntry, platformId, sub, nextBilling, amount, status_1, balance, _b, duePayments_1, payment, tx, limiters, result, digest, err_1, error_1;
        var _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    console.log("Starting Subscriptions Scheduler...");
                    // Setup keypair
                    if (!SCHEDULER_SECRET) {
                        console.error("SCHEDULER_SECRET is not set in the .env file. Please configure it.");
                        return [2 /*return*/];
                    }
                    try {
                        keypair = ed25519_1.Ed25519Keypair.fromSecretKey(SCHEDULER_SECRET);
                    }
                    catch (e) {
                        console.warn("Invalid secret key. Please set a valid scheduler secret in .env for the demo.");
                        return [2 /*return*/];
                    }
                    _k.label = 1;
                case 1:
                    _k.trys.push([1, 14, , 15]);
                    schedulerAddress = keypair.toSuiAddress();
                    console.log("Scheduler Address: ".concat(schedulerAddress));
                    // In v2, process_due_payment is permissionless, so we don't need a SchedulerCap.
                    // We will fetch all AccountCreated events to find subscription accounts.
                    console.log("Finding Subscription Accounts...");
                    hasNextPage = true;
                    cursor = null;
                    accountIds_1 = [];
                    _k.label = 2;
                case 2:
                    if (!hasNextPage) return [3 /*break*/, 4];
                    return [4 /*yield*/, client.query({
                            query: "\n                    query GetEvents($cursor: String, $type: String!) {\n                        events(first: 50, after: $cursor, filter: { type: $type }) {\n                            nodes { contents { json } }\n                            pageInfo { hasNextPage endCursor }\n                        }\n                    }\n                ",
                            variables: {
                                type: "".concat(constants_ts_1.V2_PACKAGE_ID, "::account::AccountCreated"),
                            },
                        })];
                case 3:
                    result = _k.sent();
                    if (!((_c = result.data) === null || _c === void 0 ? void 0 : _c.events)) {
                        console.error("Failed to query events:", result.errors);
                        return [3 /*break*/, 4];
                    }
                    events = {
                        data: result.data.events.nodes.map(function (n) { return ({
                            parsedJson: n.contents.json,
                        }); }),
                        hasNextPage: result.data.events.pageInfo.hasNextPage,
                        nextCursor: result.data.events.pageInfo.endCursor,
                    };
                    events.data.forEach(function (e) {
                        var json = e.parsedJson || e.json;
                        if (json === null || json === void 0 ? void 0 : json.account_id)
                            accountIds_1.push(json.account_id);
                    });
                    hasNextPage = events.hasNextPage;
                    cursor = events.nextCursor;
                    return [3 /*break*/, 2];
                case 4:
                    if (accountIds_1.length === 0) {
                        console.log("No subscription accounts found on the network.");
                        return [2 /*return*/];
                    }
                    console.log("Found ".concat(accountIds_1.length, " accounts. Checking subscriptions..."));
                    return [4 /*yield*/, client.core.getObjects({
                            objectIds: accountIds_1,
                            include: { json: true }
                        })];
                case 5:
                    accountsResult = (_k.sent()).objects;
                    duePayments = [];
                    now = Date.now();
                    for (_i = 0, accountsResult_1 = accountsResult; _i < accountsResult_1.length; _i++) {
                        acc = accountsResult_1[_i];
                        if (acc instanceof Error)
                            continue;
                        accContent = acc.json;
                        if (!accContent)
                            continue;
                        subscriptions = ((_d = accContent.subscriptions) === null || _d === void 0 ? void 0 : _d.contents) || [];
                        for (_a = 0, subscriptions_1 = subscriptions; _a < subscriptions_1.length; _a++) {
                            subEntry = subscriptions_1[_a];
                            platformId = subEntry.key;
                            sub = ((_e = subEntry.value) === null || _e === void 0 ? void 0 : _e.fields) || subEntry.value;
                            if (!sub)
                                continue;
                            nextBilling = Number(sub.next_billing_ts || sub.next_billing_time || 0);
                            amount = Number(sub.tier_amount || sub.amount || 0);
                            status_1 = (_g = (_f = sub.status) === null || _f === void 0 ? void 0 : _f.variant) !== null && _g !== void 0 ? _g : sub.status;
                            if (status_1 === 0 && now >= nextBilling && amount > 0) {
                                balance = Number(accContent.balance || 0);
                                if (balance >= amount) {
                                    duePayments.push({
                                        accountId: acc.objectId,
                                        platformId: platformId,
                                        amount: amount
                                    });
                                }
                                else {
                                    console.log("Account ".concat(acc.objectId, " has insufficient balance for subscription to platform ").concat(platformId, "."));
                                }
                            }
                        }
                    }
                    if (!(duePayments.length > 0)) return [3 /*break*/, 12];
                    console.log("Found ".concat(duePayments.length, " due subscriptions. Processing individually..."));
                    _b = 0, duePayments_1 = duePayments;
                    _k.label = 6;
                case 6:
                    if (!(_b < duePayments_1.length)) return [3 /*break*/, 11];
                    payment = duePayments_1[_b];
                    tx = new transactions_1.Transaction();
                    limiters = tx.moveCall({
                        target: "".concat(constants_ts_1.V2_PACKAGE_ID, "::policies::empty_limiters"),
                        arguments: [tx.object(constants_ts_1.CLOCK_OBJECT_ID)],
                    });
                    // 2. ensure_initialized (idempotent, rebuilds limiters from account's PolicySet)
                    tx.moveCall({
                        target: "".concat(constants_ts_1.V2_PACKAGE_ID, "::policies::ensure_initialized"),
                        typeArguments: [constants_ts_1.SUI_TYPE_ARG],
                        arguments: [
                            tx.object(payment.accountId),
                            limiters,
                            tx.object(constants_ts_1.CLOCK_OBJECT_ID)
                        ],
                    });
                    // 3. process_due_payment
                    tx.moveCall({
                        target: "".concat(constants_ts_1.V2_PACKAGE_ID, "::scheduler::process_due_payment"),
                        typeArguments: [constants_ts_1.SUI_TYPE_ARG],
                        arguments: [
                            tx.object(constants_ts_1.V2_PAYMENT_SCHEDULER_ID),
                            tx.object(payment.platformId),
                            tx.object(payment.accountId),
                            limiters,
                            tx.object(constants_ts_1.CLOCK_OBJECT_ID)
                        ]
                    });
                    _k.label = 7;
                case 7:
                    _k.trys.push([7, 9, , 10]);
                    console.log("Submitting withdrawal for account ".concat(payment.accountId, " / platform ").concat(payment.platformId, "..."));
                    return [4 /*yield*/, client.signAndExecuteTransaction({
                            transaction: tx,
                            signer: keypair,
                        })];
                case 8:
                    result = _k.sent();
                    digest = ((_h = result.Transaction) === null || _h === void 0 ? void 0 : _h.digest) || result.digest || ((_j = result.effects) === null || _j === void 0 ? void 0 : _j.transactionDigest);
                    console.log("Withdrawal successful! Digest: ".concat(digest));
                    return [3 /*break*/, 10];
                case 9:
                    err_1 = _k.sent();
                    console.error("Failed to withdraw from account ".concat(payment.accountId, ":"), err_1);
                    return [3 /*break*/, 10];
                case 10:
                    _b++;
                    return [3 /*break*/, 6];
                case 11: return [3 /*break*/, 13];
                case 12:
                    console.log("No subscriptions due on the network right now.");
                    _k.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    error_1 = _k.sent();
                    console.error("Scheduler encountered an error during this iteration:");
                    console.error(error_1);
                    console.log("Will retry on next interval.");
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// Run every 15 seconds
setInterval(runScheduler, 15000);
runScheduler(); // run immediately once
