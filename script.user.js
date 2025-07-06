// ==UserScript==
// @name         WebP怪物图标替换 (JSON资源版)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @match        https://www.milkywayidle.com/*
// @resource     monsterData https://raw.githubusercontent.com/CYR2077/MWI-MonsterFeminization/refs/heads/main/resource/monster-data.json
// @grant        GM_getResourceText
// ==/UserScript==

(function () {
    'use strict';

    // 怪物名称列表
    const monsterNames = [
        "fly", "rat", "skunk", "porcupine", "slimy", "frog", "snake", "swampy",
        "alligator", "sea_snail", "crab", "aquahorse", "nom_nom", "turtle",
        "jungle_sprite", "myconid", "treant", "centaur_archer", "gobo_stabby",
        "gobo_slashy", "gobo_smashy", "gobo_shooty", "gobo_boomy", "eye",
        "eyes", "veyes", "novice_sorcerer", "ice_sorcerer", "flame_sorcerer",
        "elementalist", "gummy_bear", "panda", "black_bear", "grizzly_bear",
        "polar_bear", "magnetic_golem", "stalactite_golem", "granite_golem",
        "zombie", "vampire", "werewolf", "abyssal_imp", "soul_hunter", 
        "infernal_warlock", "giant_shoebill", "marine_huntress", "luna_empress",
        "gobo_chieftain", "the_watcher", "chronofrost_sorcerer", "red_panda",
        "crystal_colossus", "dusk_revenant", "demonic_overlord"
    ];

    // 图片缓存
    const imageCache = new Map();
    const processedElements = new WeakSet();

    // 注入CSS
    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            use[href*="/static/media/combat_monsters_sprite.75d964d1.svg#"][data-hide-original] {
                opacity: 0 !important;
            }
            image[data-monster-replaced] {
                opacity: 1 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // 加载怪物数据
    function loadMonsterData() {
        console.log('🚀 开始加载怪物数据...');
        
        try {
            const dataText = GM_getResourceText('monsterData');
            if (!dataText) {
                console.error('❌ 无法获取资源数据');
                return 0;
            }

            const monsterData = JSON.parse(dataText);
            let loadedCount = 0;
            
            for (const [name, base64Data] of Object.entries(monsterData)) {
                if (monsterNames.includes(name) && base64Data) {
                    imageCache.set(name, base64Data);
                    loadedCount++;
                }
            }
            
            console.log(`✅ 数据加载完成: ${loadedCount}/${monsterNames.length}`);
            return loadedCount;
            
        } catch (error) {
            console.error('❌ 加载数据失败:', error);
            return 0;
        }
    }

    // 替换怪物图标
    function replaceMonsterIcons() {
        const useElements = document.querySelectorAll('use[href*="/static/media/combat_monsters_sprite.75d964d1.svg#"]');
        let replaced = 0;

        useElements.forEach(use => {
            if (processedElements.has(use)) return;

            const href = use.getAttribute('href');
            const match = href.match(/#(.+)$/);

            if (match && monsterNames.includes(match[1])) {
                const monsterName = match[1];
                const imageURL = imageCache.get(monsterName);
                
                if (imageURL) {
                    replaceElement(use, monsterName, imageURL);
                    processedElements.add(use);
                    replaced++;
                }
            }
        });

        if (replaced > 0) {
            console.log(`🔄 替换了 ${replaced} 个图标`);
        }
    }

    // 替换单个元素
    function replaceElement(use, monsterName, imageURL) {
        try {
            const svg = use.closest('svg');
            if (!svg) return;

            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            
            // 设置加载事件
            image.addEventListener('load', () => {
                use.setAttribute('data-hide-original', 'true');
            });
            
            image.addEventListener('error', () => {
                console.warn(`❌ 图片显示失败: ${monsterName}`);
                if (image.parentNode) {
                    image.parentNode.removeChild(image);
                }
            });

            // 复制属性
            Array.from(use.attributes).forEach(attr => {
                if (attr.name !== 'href') {
                    image.setAttribute(attr.name, attr.value);
                }
            });

            // 设置图片
            image.setAttribute('href', imageURL);
            image.setAttribute('data-monster-replaced', monsterName);
            
            if (!image.getAttribute('width')) image.setAttribute('width', '100%');
            if (!image.getAttribute('height')) image.setAttribute('height', '100%');
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // 添加到DOM
            use.parentNode.insertBefore(image, use);
        } catch (error) {
            console.error(`❌ 替换失败: ${monsterName}`, error);
        }
    }

    // 监听DOM变化
    function setupObserver() {
        const observer = new MutationObserver(() => {
            replaceMonsterIcons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 初始化
    function init() {
        console.log('🎮 怪物图标替换器启动 (JSON资源版)...');
        
        injectCSS();
        
        const loadedCount = loadMonsterData();
        if (loadedCount === 0) {
            console.error('❌ 数据包加载失败，请检查monster-data.json文件');
            return;
        }
        
        setupObserver();
        replaceMonsterIcons();
        setInterval(replaceMonsterIcons, 2000);
        
        console.log('✅ 初始化完成');
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();