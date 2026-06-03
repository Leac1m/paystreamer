// Copyright (c) leac1m
// SPDX-License-Identifier: Apache-2.0

module subscriptions::subscription_e2e_tests;

use std::string;
use std::unit_test::assert_eq;
use sui::coin::mint_for_testing;
use sui::clock::{Clock, increment_for_testing};
use sui::sui::SUI;
use sui::test_scenario::{begin, end, next_tx, take_from_sender, take_shared, return_to_sender, return_shared};

use subscriptions::platform_registry::{
    register_platform, create_tier, process_withdrawal, platform_id, owner_cap_platform_id,
    billing_frequency_monthly,
};
use subscriptions::subscription_account::{
    create_account, deposit, account_balance, subscription_total_paid, subscription_payment_count,
};
use subscriptions::subscription_manager::create_subscription;

#[test]
fun happy_path_end_to_end() {
    let platform_owner = @0xA;
    let user = @0xB;

    // ===== TX 1: Platform owner registers a platform =====
    let mut scenario = begin(platform_owner);

    register_platform(
        string::utf8(b"My Platform"),
        string::utf8(b"A great platform"),
        string::utf8(b"entertainment"),
        option::none(),
        scenario.ctx(),
    );

    // PlatformOwnerCap goes to sender
    next_tx(platform_owner, &mut scenario);
    let owner_cap = take_from_sender<subscriptions::platform_registry::PlatformOwnerCap>(&scenario);

    // Platform is shared
    next_tx(platform_owner, &mut scenario);
    let mut platform = take_shared<subscriptions::platform_registry::Platform>(&scenario);

    // ===== TX 2: Platform owner creates a tier =====
    next_tx(platform_owner, &mut scenario);
    create_tier(
        &owner_cap,
        &mut platform,
        string::utf8(b"Basic"),
        1_000_000, // 1 SUI per month (6 decimals)
        billing_frequency_monthly(),
        scenario.ctx(),
    );

    return_shared(platform);

    // ===== TX 3: User creates an account =====
    next_tx(user, &mut scenario);
    let (account_id, account_cap) = create_account<SUI>(&sui::coin::Coin {}, scenario.ctx());

    // AccountCap goes to user
    let cap = take_from_sender<subscriptions::subscription_account::AccountCap>(&scenario);

    // Account is shared
    next_tx(user, &mut scenario);
    let mut account = take_shared<subscriptions::subscription_account::SubscriptionAccount<SUI>>(&scenario);

    // ===== TX 4: User deposits funds =====
    next_tx(user, &mut scenario);
    let coin = mint_for_testing<SUI>(10_000_000, scenario.ctx()); // 10 SUI
    deposit(&cap, &mut account, coin, scenario.ctx());

    // Verify balance
    assert_eq!(account_balance(&account), 10_000_000);

    return_to_sender(cap);
    return_shared(account);

    // ===== TX 5: User creates a subscription =====
    next_tx(user, &mut scenario);
    let cap = take_from_sender<subscriptions::subscription_account::AccountCap>(&scenario);
    let mut account = take_shared<subscriptions::subscription_account::SubscriptionAccount<SUI>>(&scenario);
    let platform = take_shared<subscriptions::platform_registry::Platform>(&scenario);

    let clock = Clock::create_for_testing(scenario.ctx());
    create_subscription<SUI>(&cap, &mut account, &platform, 0, &clock, scenario.ctx());

    return_to_sender(cap);
    return_shared(account);
    return_shared(platform);
    mint_for_testing(clock.into_burn(), scenario.ctx()); // destroy clock

    // ===== TX 6: Platform owner processes withdrawal =====
    next_tx(platform_owner, &mut scenario);
    let owner_cap = take_from_sender<subscriptions::platform_registry::PlatformOwnerCap>(&scenario);
    let mut account = take_shared<subscriptions::subscription_account::SubscriptionAccount<SUI>>(&scenario);

    // Create and advance clock
    let mut clock = Clock::create_for_testing(scenario.ctx());
    increment_for_testing(&mut clock, 86400000 * 31); // advance 31 days (past monthly billing)

    let platform_id = owner_cap_platform_id(&owner_cap);
    process_withdrawal<SUI>(&owner_cap, &mut account, 1_000_000, &clock, scenario.ctx());

    // Verify account balance decreased
    assert_eq!(account_balance(&account), 9_000_000); // 10 - 1

    // Verify payment was recorded
    let sub = subscriptions::subscription_account::get_subscription(&account, &platform_id);
    assert_eq!(subscription_total_paid(sub), 1_000_000);
    assert_eq!(subscription_payment_count(sub), 1);

    return_to_sender(owner_cap);
    return_shared(account);
    mint_for_testing(clock.into_burn(), scenario.ctx()); // destroy clock

    end(scenario);
}