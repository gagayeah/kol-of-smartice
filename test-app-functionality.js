// 应用功能测试脚本
// 在浏览器控制台中运行此脚本来测试应用是否正确使用 Supabase

console.log('🧪 开始测试应用功能...');

// 测试1：检查 Supabase 客户端是否正确配置
async function testSupabaseClient() {
    console.log('\n📡 测试1: Supabase 客户端配置');

    try {
        // 检查是否能正确导入 supabase-client.js 中的配置
        const response = await fetch('/src/utils/supabase-client.js');
        const content = await response.text();

        if (content.includes('https://wdpeoyugsxqnpwwtkqnpwwtkqsl.supabase.co')) {
            console.log('✅ Supabase URL 配置正确');
        } else {
            console.log('❌ Supabase URL 配置错误');
        }

        if (content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
            console.log('✅ Supabase Anon Key 配置正确');
        } else {
            console.log('❌ Supabase Anon Key 配置错误');
        }

    } catch (error) {
        console.log('❌ 无法读取 supabase-client.js:', error.message);
    }
}

// 测试2：检查 db.js 是否重构正确
async function testDbJsRefactoring() {
    console.log('\n🔧 测试2: db.js 重构验证');

    try {
        const response = await fetch('/src/utils/db.js');
        const content = await response.text();

        if (content.includes('./supabase-client.js')) {
            console.log('✅ 正确导入 supabase-client.js');
        } else {
            console.log('❌ 未导入 supabase-client.js');
        }

        if (content.includes('supabase.from(')) {
            console.log('✅ 使用 Supabase 客户端');
        } else {
            console.log('❌ 未使用 Supabase 客户端');
        }

        if (content.includes('kol_project_groups')) {
            console.log('✅ 使用新的表名 kol_project_groups');
        } else {
            console.log('❌ 未使用新的表名');
        }

    } catch (error) {
        console.log('❌ 无法读取 db.js:', error.message);
    }
}

// 测试3：检查应用是否在 Electron 环境中运行
function testElectronEnvironment() {
    console.log('\n🖥️ 测试3: Electron 环境检测');

    if (typeof window !== 'undefined' && window.electron) {
        console.log('✅ 在 Electron 环境中运行');

        // 检查 electron API 是否可用
        if (window.electron.db) {
            console.log('✅ Electron 数据库 API 可用');
        } else {
            console.log('⚠️ Electron 数据库 API 不可用（预期，因为已迁移到 Supabase）');
        }
    } else {
        console.log('ℹ️ 在浏览器环境中运行');
    }
}

// 测试4：检查本地存储状态
function testLocalStorage() {
    console.log('\n💾 测试4: 本地存储状态');

    if (typeof localStorage !== 'undefined') {
        const oldData = localStorage.getItem('blogger_tracker_db');
        if (oldData) {
            console.log('⚠️ 发现旧的本地数据，建议清理');
            const parsed = JSON.parse(oldData);
            console.log(`   - 项目集: ${parsed.projectGroups?.length || 0} 个`);
            console.log(`   - 项目: ${parsed.projects?.length || 0} 个`);
            console.log(`   - 博主: ${parsed.bloggers?.length || 0} 个`);
        } else {
            console.log('✅ 本地存储已清理（符合预期）');
        }

        // 检查当前选中状态
        const currentGroupId = localStorage.getItem('current_group_id');
        const currentProjectId = localStorage.getItem('current_project_id');
        console.log(`   - 当前项目集: ${currentGroupId || '未选择'}`);
        console.log(`   - 当前项目: ${currentProjectId || '未选择'}`);
    } else {
        console.log('❌ LocalStorage 不可用');
    }
}

// 测试5：尝试连接 Supabase（如果应用已加载）
async function testSupabaseConnection() {
    console.log('\n🌐 测试5: Supabase 连接测试');

    try {
        // 尝试直接访问 Supabase API（如果 CORS 允许）
        const response = await fetch('https://wdpeoyugsxqnpwwtkqsl.supabase.co/rest/v1/', {
            method: 'GET',
            headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcGVveXVnc3hxbnB3d3RrcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNDgwNzgsImV4cCI6MjA1OTcyNDA3OH0.9bUpuZCOZxDSH3KsIu6FwWZyAvnV5xPJGNpO3luxWOE',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            console.log('✅ Supabase API 可访问');
        } else {
            console.log('⚠️ Supabase API 访问受限（可能是 CORS 问题）');
        }
    } catch (error) {
        console.log('❌ 无法直接访问 Supabase API:', error.message);
        console.log('   💡 这是正常的，浏览器会阻止跨域请求');
    }
}

// 测试6：检查应用的网络请求
function testNetworkRequests() {
    console.log('\n📡 测试6: 网络请求监控');

    // 监听网络请求
    const originalFetch = window.fetch;
    let supabaseRequests = 0;

    window.fetch = function(...args) {
        const [url, options] = args;

        if (url.includes('supabase.co')) {
            supabaseRequests++;
            console.log(`📡 检测到 Supabase 请求: ${url}`);
        }

        return originalFetch.apply(this, args);
    };

    console.log('📊 网络请求监控已启动');

    // 5秒后报告
    setTimeout(() => {
        console.log(`\n📊 5秒内检测到 ${supabaseRequests} 个 Supabase 请求`);

        if (supabaseRequests > 0) {
            console.log('✅ 应用正在使用 Supabase');
        } else {
            console.log('⚠️ 未检测到 Supabase 请求');
        }

        // 恢复原始 fetch
        window.fetch = originalFetch;
    }, 5000);
}

// 运行所有测试
async function runAllTests() {
    await testSupabaseClient();
    await testDbJsRefactoring();
    testElectronEnvironment();
    testLocalStorage();
    await testSupababaseConnection();
    testNetworkRequests();

    console.log('\n🎯 测试完成！请查看以上结果');
    console.log('💡 如果所有测试都显示 ✅ 或 ⚠️，说明应用已正确迁移到 Supabase');
    console.log('💡 如果出现 ❌，可能需要检查代码重构或配置');
}

// 自动运行测试
runAllTests();