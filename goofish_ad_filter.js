/**
 * 闲鱼 Loon 响应净化脚本
 *
 * 基于 GoofishAds.conf V1.0.11 的既有净化范围，增加：
 * 1. 清除普通搜索页、商品详情页搜索框填充词；
 * 2. 移除首页全部频道（金刚位），包括登录后的刷新响应；
 * 3. 移除搜索激活页的推荐标签和热搜榜；
 * 4. 移除商品详情“换机补贴”营销组件；
 * 5. 清除“集市”旁的“更便宜”图片角标。
 *
 * 所有处理均使用 HAR 中确认的结构字段或稳定业务标识。
 * 解析失败、响应为空或结构未知时放行原响应。
 */

var url = $request.url;
var body = $response.body;

if (!body) {
    $done({});
} else {
    try {
        var obj = JSON.parse(body);

        if (url.indexOf("mtop.taobao.idlehome.home.circle.list") !== -1) {
            cleanHomeTabs(obj);
        } else if (
            url.indexOf("mtop.taobao.idlehome.home.nextfresh") !== -1 ||
            url.indexOf("mtop.taobao.idlehome.widget.refresh.get") !== -1
        ) {
            cleanHomeResponse(obj);
        } else if (
            url.indexOf("mtop.taobao.idlemtopsearch.search.shade") !== -1 ||
            url.indexOf("mtop.taobao.idlemtopsearch.detailpage.search.shade") !== -1
        ) {
            cleanSearchShade(obj, url);
        } else if (
            url.indexOf("mtop.taobao.idlemtopsearch.search.activate.tablist") !== -1 ||
            url.indexOf("mtop.taobao.idlemtopsearch.search.activate.trendlist") !== -1
        ) {
            cleanSearchActivate(obj, url);
        } else if (url.indexOf("mtop.idle.user.page.my.adapter") !== -1) {
            cleanMyPage(obj);
        } else if (url.indexOf("mtop.taobao.idle.awesome.detail.unit") !== -1) {
            cleanItemDetail(obj);
        }

        $done({ body: JSON.stringify(obj) });
    } catch (error) {
        console.log("闲鱼净化失败，放行原响应: " + error);
        $done({});
    }
}

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanHomeTabs(obj) {
    if (!isObject(obj.data)) {
        return;
    }

    obj.data.circleList = removeSaveMoneyTab(obj.data.circleList);
    clearMarketBadge(obj.data.headList);

    if (isObject(obj.data.next)) {
        obj.data.next.circleList = removeSaveMoneyTab(obj.data.next.circleList);
        clearMarketBadge(obj.data.next.headList);
    }
}

function removeSaveMoneyTab(list) {
    if (!Array.isArray(list)) {
        return list;
    }

    return list.filter(function (item) {
        return !isObject(item) || item.bizCode !== "saveMoney";
    });
}

function clearMarketBadge(list) {
    if (!Array.isArray(list)) {
        return;
    }

    list.forEach(function (item) {
        if (
            isObject(item) &&
            item.bizCode === "market" &&
            String(item.circleId) === "202" &&
            isObject(item.showInfo)
        ) {
            item.showInfo.rightTagImage = {
                lightUrl: "",
                selectUrl: "",
                url: ""
            };
        }
    });
}

function cleanHomeResponse(obj) {
    if (!isObject(obj.data)) {
        return;
    }

    removeChannelSections(obj.data);

    // 保留原插件行为：首页信息流只保留普通商品卡片。
    if (Array.isArray(obj.data.sections)) {
        obj.data.sections = obj.data.sections.filter(function (section) {
            return isObject(section) &&
                isObject(section.data) &&
                section.data.bizType === "item";
        });
    }
}

function removeChannelSections(data) {
    if (Array.isArray(data.homeTopList)) {
        data.homeTopList = data.homeTopList.filter(function (section) {
            return !isChannelSection(section);
        });
    }

    if (isObject(data.widgetReturnDO) && Array.isArray(data.widgetReturnDO.widgets)) {
        data.widgetReturnDO.widgets = data.widgetReturnDO.widgets.filter(function (widget) {
            return !isChannelWidget(widget);
        });
    }
}

function isChannelSection(section) {
    if (!isObject(section)) {
        return false;
    }

    if (section.sectionType === "kingkongDo") {
        return true;
    }

    if (isObject(section.template) && section.template.name === "fy25_fish_kingkong") {
        return true;
    }

    if (Array.isArray(section.widgets)) {
        return section.widgets.some(isChannelWidget);
    }

    return false;
}

function isChannelWidget(widget) {
    if (!isObject(widget)) {
        return false;
    }

    if (widget.widgetType === "channelWidget") {
        return true;
    }

    return isObject(widget.widgetDO) && Array.isArray(widget.widgetDO.channelDOList);
}

function cleanSearchShade(obj, requestUrl) {
    if (!isObject(obj.data)) {
        return;
    }

    if (requestUrl.indexOf("detailpage.search.shade") !== -1) {
        if (isObject(obj.data.idleShadeOutputDo)) {
            obj.data.idleShadeOutputDo.result = [];
            obj.data.idleShadeOutputDo.scroll = "false";
        }
        return;
    }

    // 与原插件一致，保留一个空对象以兼容客户端对数组首项的读取。
    if (Array.isArray(obj.data.singleShadeWords)) {
        obj.data.singleShadeWords = [{}];
    }
}

function cleanSearchActivate(obj, requestUrl) {
    if (!isObject(obj.data)) {
        return;
    }

    if (
        requestUrl.indexOf("search.activate.tablist") !== -1 &&
        Array.isArray(obj.data.tabList)
    ) {
        obj.data.tabList = [];
    }

    if (
        requestUrl.indexOf("search.activate.trendlist") !== -1 &&
        Array.isArray(obj.data.resultList)
    ) {
        obj.data.resultList = [];
    }
}

function cleanMyPage(obj) {
    if (!isObject(obj.data)) {
        return;
    }

    // 保留原插件行为：清空能力区，只保留头部、用户和交易楼层。
    obj.data.ability = [];

    if (!isObject(obj.data.container) || !Array.isArray(obj.data.container.sections)) {
        return;
    }

    obj.data.container.sections = obj.data.container.sections.filter(function (section) {
        if (!isObject(section) || typeof section.sectionBizCode !== "string") {
            return false;
        }
        return /head|user|trade/.test(section.sectionBizCode);
    });

}

function cleanItemDetail(obj) {
    var flowData = isObject(obj.data) && isObject(obj.data.flowData)
        ? obj.data.flowData
        : null;
    var detailBody = flowData && isObject(flowData.body)
        ? flowData.body
        : null;

    if (!detailBody || !Array.isArray(detailBody.sections)) {
        return;
    }

    detailBody.sections.forEach(function (section) {
        if (!isObject(section) || !Array.isArray(section.components)) {
            return;
        }

        section.components = section.components.filter(function (component) {
            if (!isObject(component) || component.key !== "Basic_Native_spn_marketing_module") {
                return true;
            }

            var componentData = isObject(component.data) ? component.data : null;
            var template = componentData && isObject(componentData.template)
                ? componentData.template
                : null;

            return !template || template.name !== "marketing_module_bargain_activity";
        });
    });
}
