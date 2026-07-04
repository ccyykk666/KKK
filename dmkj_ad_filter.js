/**
 * 到梦空间 App 去广告过滤脚本
 *
 * 处理三个接口的广告数据：
 * 1. /v2/index/promotionlist - 首页推广 banner 广告
 * 2. /equities/page           - 权益页面外部 App 跳转广告
 * 3. /points/index            - 积分页面广告开关
 *
 * 策略：
 * - 使用结构字段判断（banner_type, actionType, ad），不使用关键词匹配或下标删除
 * - JSON 解析失败直接返回原始响应，保证 App 正常使用
 */

var url = $request.url;
var body = $response.body;

try {
    var obj = JSON.parse(body);

    // ============================================================
    // 1. 首页推广列表：清除 bannerLis
    //    bannerList 内每项均含 banner_type:"1" + exposureNum/click_count
    //    这些字段是广告投放系统的标准标识，正常功能模块不会携带
    // ============================================================
    if (url.indexOf("/v2/index/promotionlist") !== -1) {
        if (obj.data && Array.isArray(obj.data.bannerList)) {
            obj.data.bannerList = [];
        }
    }

    // ============================================================
    // 2. 权益页面：两层过滤
    //    过滤层1: actionType === 3 → 外部 App scheme (taobao:// 等)
    //    过滤层2: actionUrl 域名非平台自有 → 第三方商业推广链接
    //    保留项: /pages/ 内部路由、apph5.5idream.net/notice/ 平台公告、
    //            daomengs.com 静态资源
    // ============================================================
    if (url.indexOf("/equities/page") !== -1) {
        if (obj.data && Array.isArray(obj.data.list)) {
            obj.data.list = obj.data.list.filter(function(item) {
                // 过滤层1: actionType === 3 属外部 App 唤起推广
                if (item.actionType === 3) {
                    return false;
                }
                // 过滤层2: 检查跳转目标域名是否属于平台自有域名
                // 内部路由 /pages/ 直接放行
                var target = item.actionUrl || item.skipUrl || item.url || "";
                if (target.indexOf("/pages/") === 0) {
                    return true;
                }
                // 提取 hostname，非平台自有域名则为第三方推广
                var host = extractHost(target);
                if (host && !isOwnDomain(host)) {
                    return false;
                }
                return true;
            });
        }
    }

    // ============================================================
    // 工具函数: 从 URL 中提取 hostname
    // 例: "https://m.tb.cn/h.RiEqDM1" → "m.tb.cn"
    //     "/pages/alonePlatform/..." → "" (无协议头，不是外部链接)
    // ============================================================
    function extractHost(urlStr) {
        if (!urlStr || urlStr.indexOf("://") === -1) return "";
        var start = urlStr.indexOf("://") + 3;
        var end = urlStr.indexOf("/", start);
        if (end === -1) end = urlStr.length;
        return urlStr.substring(start, end);
    }

    // ============================================================
    // 工具函数: 判断域名是否为平台自有域名
    // 通过域名后缀匹配，而非 URL 路径关键词匹配
    // ============================================================
    function isOwnDomain(host) {
        if (!host) return false;
        var ownDomains = ["5idream.net", "daomengs.com"];
        for (var i = 0; i < ownDomains.length; i++) {
            if (host === ownDomains[i] || host.indexOf("." + ownDomains[i]) === host.length - ownDomains[i].length - 1) {
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // 3. 积分页面：关闭广告开关
    //    data.ad: 1 是广告总开关标志位
    //    各 *AdId 字段控制前端具体广告位的渲染
    //    将这些字段置零可让客户端跳过广告内容加载
    // ============================================================
    if (url.indexOf("/points/index") !== -1) {
        if (obj.data) {
            // 广告总开关
            if (typeof obj.data.ad === "number") {
                obj.data.ad = 0;
            }
            // 各广告位 ID 清空
            var adIdFields = [
                "centerTaskAdId",
                "listAdId",
                "bannerAdId",
                "centerAdId",
                "listTaskAdId"
            ];
            for (var i = 0; i < adIdFields.length; i++) {
                var field = adIdFields[i];
                if (field in obj.data) {
                    obj.data[field] = 0;
                }
            }
        }
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    // JSON 解析失败或字段结构变化时，不破坏原始响应
    // 保证 App 核心功能不受影响
    $done({ body: body });
}
