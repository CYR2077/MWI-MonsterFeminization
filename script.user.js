// ==UserScript==
// @name         WebP Atlas怪物图标替换
// @namespace    http://tampermonkey.net/
// @version      2.0
// @match        https://www.milkywayidle.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 完整怪物英文名列表 (已添加新怪物)
    const Names = [
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

    // ==================== 配置 ====================
    const CONFIG = {
        // WebP Atlas 文件路径 - 请修改为你的实际路径
        ATLAS_URL: 'https://github.com/CYR2077/MWI-MonsterFeminization/resource/monster-atlas.webp',
        ATLAS_CONFIG_URL: 'https://github.com/CYR2077/MWI-MonsterFeminization/resource/monster-atlas.json',
        
        // 可选：备用单独文件路径（当Atlas加载失败时使用）
        FALLBACK_BASE_URL: 'https://your-domain.com/monster-images/'
    };

    // ==================== Atlas 图片缓存管理器 ====================
    class AtlasImageCache {
        constructor() {
            this.cache = new Map();
            this.isLoaded = false;
            this.loadPromise = null;
        }

        // 预加载Atlas
        async preloadAtlas() {
            if (this.loadPromise) return this.loadPromise;
            
            this.loadPromise = this._loadAtlas();
            return this.loadPromise;
        }

        async _loadAtlas() {
            console.log('🚀 开始加载怪物Atlas...');
            const startTime = performance.now();

            try {
                // 并行加载Atlas图片和配置文件
                const [atlasBlob, configResponse] = await Promise.all([
                    this._fetchAsBlob(CONFIG.ATLAS_URL),
                    fetch(CONFIG.ATLAS_CONFIG_URL).then(r => {
                        if (!r.ok) throw new Error(`配置文件加载失败: ${r.status}`);
                        return r.json();
                    })
                ]);

                const atlasUrl = URL.createObjectURL(atlasBlob);
                console.log('📦 Atlas和配置文件加载完成，开始处理图片...');
                
                // 为每个怪物创建裁剪后的图片
                let processedCount = 0;
                const promises = Names.map(async (name) => {
                    if (configResponse[name]) {
                        try {
                            const croppedUrl = await this._createCroppedImage(atlasUrl, configResponse[name]);
                            this.cache.set(name, croppedUrl);
                            processedCount++;
                            
                            if (processedCount % 10 === 0) {
                                console.log(`📸 已处理 ${processedCount}/${Names.length} 个图片...`);
                            }
                        } catch (error) {
                            console.warn(`⚠️  处理图片失败: ${name}`, error);
                        }
                    } else {
                        console.warn(`⚠️  配置中未找到: ${name}`);
                    }
                });

                await Promise.allSettled(promises);
                
                // 释放Atlas URL
                URL.revokeObjectURL(atlasUrl);
                
                const loadTime = (performance.now() - startTime).toFixed(2);
                console.log(`✅ Atlas加载完成！用时: ${loadTime}ms, 成功: ${processedCount}/${Names.length}`);
                
                this.isLoaded = true;
                return true;
                
            } catch (error) {
                console.error('❌ Atlas加载失败:', error);
                
                // 降级到单独文件模式
                if (CONFIG.FALLBACK_BASE_URL) {
                    console.log('🔄 降级到单独文件模式...');
                    await this._loadIndividualFiles();
                }
                return false;
            }
        }

        // 降级方案：加载单独文件
        async _loadIndividualFiles() {
            const promises = Names.map(async (name) => {
                try {
                    const url = `${CONFIG.FALLBACK_BASE_URL}${name}.webp`;
                    const blob = await this._fetchAsBlob(url);
                    const objectUrl = URL.createObjectURL(blob);
                    this.cache.set(name, objectUrl);
                } catch (error) {
                    console.warn(`❌ 单独文件加载失败: ${name}.webp`);
                }
            });

            await Promise.allSettled(promises);
            console.log(`📁 单独文件模式完成，成功: ${this.cache.size}/${Names.length}`);
        }

        // 从Atlas创建裁剪图片
        async _createCroppedImage(atlasUrl, cropData) {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                img.onload = () => {
                    try {
                        canvas.width = cropData.width;
                        canvas.height = cropData.height;
                        
                        ctx.drawImage(
                            img,
                            cropData.x, cropData.y, cropData.width, cropData.height,
                            0, 0, cropData.width, cropData.height
                        );
                        
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(URL.createObjectURL(blob));
                            } else {
                                reject(new Error('Canvas转换失败'));
                            }
                        }, 'image/webp', 0.9);
                    } catch (error) {
                        reject(error);
                    }
                };

                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = atlasUrl;
            });
        }

        // 获取缓存的图片URL
        get(name) {
            return this.cache.get(name);
        }

        // 检查是否已缓存
        has(name) {
            return this.cache.has(name);
        }

        // 获取加载状态
        isReady() {
            return this.isLoaded;
        }

        // 工具方法：获取Blob
        async _fetchAsBlob(url) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.blob();
        }

        // 清理缓存
        cleanup() {
            for (const url of this.cache.values()) {
                URL.revokeObjectURL(url);
            }
            this.cache.clear();
        }
    }

    // ==================== 图标替换器 ====================
    class IconReplacer {
        constructor(imageCache) {
            this.imageCache = imageCache;
            this.processedElements = new WeakSet();
            this.totalReplaced = 0;
        }

        // 替换图标
        async replaceIcons() {
            // 确保Atlas已加载
            await this.imageCache.preloadAtlas();
            
            const useElements = document.querySelectorAll('use[href*="/static/media/combat_monsters_sprite.75d964d1.svg#"]');
            let replacedCount = 0;

            useElements.forEach(use => {
                if (this.processedElements.has(use)) return;

                const href = use.getAttribute('href');
                const match = href.match(/#(.+)$/);

                if (match && Names.includes(match[1])) {
                    const monsterId = match[1];
                    
                    if (this.imageCache.has(monsterId)) {
                        this.replaceUseElement(use, monsterId);
                        this.processedElements.add(use);
                        replacedCount++;
                        this.totalReplaced++;
                    }
                }
            });

            if (replacedCount > 0) {
                console.log(`🔄 本次替换了 ${replacedCount} 个图标 (总计: ${this.totalReplaced})`);
            }
        }

        // 替换单个use元素
        replaceUseElement(use, monsterId) {
            const svg = use.closest('svg');
            if (!svg) return;

            try {
                const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                
                // 复制属性
                Array.from(use.attributes).forEach(attr => {
                    if (attr.name !== 'href') {
                        image.setAttribute(attr.name, attr.value);
                    }
                });

                // 设置缓存的图片URL
                const imageUrl = this.imageCache.get(monsterId);
                image.setAttribute('href', imageUrl);
                
                // 设置尺寸和适应方式
                if (!image.getAttribute('width')) image.setAttribute('width', '100%');
                if (!image.getAttribute('height')) image.setAttribute('height', '100%');
                image.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                // 替换元素
                use.parentNode.replaceChild(image, use);
                
            } catch (error) {
                console.error(`❌ 替换失败: ${monsterId}`, error);
            }
        }
    }

    // ==================== 主程序 ====================
    let imageCache;
    let iconReplacer;
    let isInitialized = false;

    async function initialize() {
        if (isInitialized) return;
        
        console.log('🎮 WebP Atlas怪物图标替换器启动...');
        console.log('📋 怪物总数:', Names.length);
        console.log('🌐 Atlas路径:', CONFIG.ATLAS_URL);
        
        // 创建缓存管理器和替换器
        imageCache = new AtlasImageCache();
        iconReplacer = new IconReplacer(imageCache);
        
        // 开始预加载（异步）
        imageCache.preloadAtlas().then(() => {
            // Atlas加载完成后立即执行替换
            iconReplacer.replaceIcons();
        });
        
        isInitialized = true;
        console.log('✨ 初始化完成！');
    }

    // DOM变化监听器
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            if (!isInitialized) return;
            
            let hasNewNodes = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    // 检查是否有相关的新节点
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'use' || node.querySelector?.('use')) {
                                hasNewNodes = true;
                                break;
                            }
                        }
                    }
                }
            });
            
            if (hasNewNodes) {
                // 延迟执行，避免频繁调用
                setTimeout(() => iconReplacer.replaceIcons(), 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 调试功能：显示当前页面中的怪物
    function debugCurrentMonsters() {
        setTimeout(() => {
            const useElements = document.querySelectorAll('use[href*="/static/media/combat_monsters_sprite.75d964d1.svg#"]');
            const foundIds = Array.from(useElements).map(use => {
                const href = use.getAttribute('href');
                const match = href.match(/#(.+)$/);
                return match ? match[1] : null;
            }).filter(id => id);
            
            const uniqueIds = [...new Set(foundIds)];
            console.log('🔍 页面中发现的怪物:', uniqueIds);
            
            const inList = uniqueIds.filter(id => Names.includes(id));
            const notInList = uniqueIds.filter(id => !Names.includes(id));
            
            if (inList.length > 0) {
                console.log('✅ 将被替换的怪物:', inList);
            }
            if (notInList.length > 0) {
                console.log('❓ 未在列表中的怪物:', notInList);
            }
        }, 2000);
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        if (imageCache) {
            imageCache.cleanup();
        }
    });

    // 页面可见性变化处理
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isInitialized) {
            setTimeout(() => iconReplacer.replaceIcons(), 500);
        }
    });

    // 启动程序
    setTimeout(initialize, 1000);
    setupObserver();
    debugCurrentMonsters();

})();