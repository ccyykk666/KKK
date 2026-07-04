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
    // 2. 权益页面：过滤 actionType === 3 的项
    //    actionType 字段取值：
    //      1 - 普通网页 URL 跳转
    //      3 - 外部 App scheme 跳转（taobao://, tbopen:// 等）
    //      5 - 内部页面 /pages/ 路由跳转
    //    actionType === 3 的项点击后直接唤起第三方购物 App，
    //    明确为商业推广广告，不属于平台自身权益功能
    // ============================================================
    if (url.indexOf("/equities/page") !== -1) {
        if (obj.data && Array.isArray(obj.data.list)) {
            obj.data.list = obj.data.list.filter(function(item) {
                // 只保留 actionType 不是 3 的项
                // actionType === 3 是外部 App 唤起类推广
                return item.actionType !== 3;
            });
        }
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
