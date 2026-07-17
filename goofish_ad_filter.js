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
