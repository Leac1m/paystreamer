import os
import re

TEST_DIR = 'tests'

for root, _, files in os.walk(TEST_DIR):
    for f in files:
        if f.endswith('.move'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as file:
                content = file.read()
                
            # Regex to find:
            # let platform_id = platform::register_platform(
            #     ... args ...
            # );
            # We want to replace it with:
            # let (platform, receipt) = platform::create_platform(
            #     ... args ...
            # );
            # let platform_id = sui::object::id(&platform);
            # platform::register_platform(platform, receipt);
            
            pattern = re.compile(r'let\s+([a-zA-Z0-9_]+)\s*=\s*platform::register_platform\s*\((.*?)\);', re.DOTALL)
            
            def repl(match):
                var_name = match.group(1)
                args = match.group(2)
                return f"""let (platform, receipt) = platform::create_platform({args});
        let {var_name} = sui::object::id(&platform);
        platform::register_platform(platform, receipt);"""
            
            new_content = pattern.sub(repl, content)
            
            if new_content != content:
                with open(filepath, 'w') as file:
                    file.write(new_content)
                print(f"Refactored {filepath}")
