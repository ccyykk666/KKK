// 京东标准版页面净化。
// 消息页推荐使用“保留成功响应、清空所有推荐数组”的方式，避免 reject-dict/0 bytes 触发网络错误。

const url = $request.url;

function removeKeys(object, keys) {
  if (!object || typeof object !== "object") return;
  for (const key of keys) delete object[key];
}

function cleanOrderFloors(floors) {
  if (!Array.isArray(floors)) return floors;

  return floors.filter((floor) => {
    if (["bannerFloor", "bpDynamicFloor", "plusFloor"].includes(floor?.mId)) {
      return false;
    }

    if (floor?.mId === "virtualServiceCenter") {
      const centers = floor?.data?.virtualServiceCenters;
      if (Array.isArray(centers)) {
        for (const center of centers) {
          if (Array.isArray(center?.serviceList)) {
            center.serviceList = center.serviceList.filter(
              (card) => card?.serviceTitle !== "精选特惠"
            );
          }
        }
      }
    }

    if (floor?.mId === "customerServiceFloor" && floor?.data?.moreText) {
      removeKeys(floor.data, ["moreIcon", "moreIcon_dark"]);
      floor.data.moreText = " ";
    }

    return true;
  });
}

const PERSON_FLOORS_TO_REMOVE = new Set([
  "bigSaleFloor",
  "buyOften",
  "marketTNFloor",
  "newAttentionCard",
  "newBigSaleFloor",
  "newStyleAttentionCard",
  "newsFloor",
  "noticeFloor",
  "recommendfloor",
]);

function cleanPersonFloors(floors) {
  if (!Array.isArray(floors)) return floors;

  return floors.filter((floor) => {
    if (PERSON_FLOORS_TO_REMOVE.has(floor?.mId)) return false;

    if (floor?.mId === "basefloorinfo") {
      removeKeys(floor?.data, [
        "commonPopup",
        "commonPopup_dynamic",
        "floatLayer",
      ]);
      if (Array.isArray(floor?.data?.commonTips)) floor.data.commonTips = [];
      if (Array.isArray(floor?.data?.commonWindows)) floor.data.commonWindows = [];
    }

    if (floor?.mId === "orderIdFloor") {
      const infos = floor?.data?.commentRemindInfo?.infos;
      if (Array.isArray(infos)) floor.data.commentRemindInfo.infos = [];
    }

    if (floor?.mId === "userinfo") {
      removeKeys(floor?.data, ["newPlusBlackCard"]);
    }

    return true;
  });
}

function successCodeLike(value) {
  return typeof value === "number" ? 0 : "0";
}

function markSuccess(object) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return;

  if (Object.prototype.hasOwnProperty.call(object, "code")) {
    object.code = successCodeLike(object.code);
  }
  if (Object.prototype.hasOwnProperty.call(object, "success")) {
    object.success = true;
  }
  if (Object.prototype.hasOwnProperty.call(object, "message")) {
    object.message = "";
  }
  if (Object.prototype.hasOwnProperty.call(object, "msg")) {
    object.msg = "";
  }
}

function emptyRecommendationCollections(value, state, depth = 0) {
  if (Array.isArray(value)) {
    state.arrayCount += 1;
    return [];
  }

  if (!value || typeof value !== "object" || depth > 30) return value;

  for (const key of Object.keys(value)) {
    const child = value[key];

    if (typeof child === "string" && /^[\[{]/.test(child.trim())) {
      try {
        const parsed = JSON.parse(child);
        const arraysBefore = state.arrayCount;
        const cleaned = emptyRecommendationCollections(parsed, state, depth + 1);
        if (state.arrayCount > arraysBefore) value[key] = JSON.stringify(cleaned);
      } catch (_) {
        // 普通文本字段保持不变。
      }
      continue;
    }

    value[key] = emptyRecommendationCollections(child, state, depth + 1);

    if (/^(?:hasMore|hasNext|more)$/.test(key)) {
      value[key] = typeof child === "boolean" ? false : 0;
    } else if (/(?:total|count|num|size)$/i.test(key) && typeof child === "number") {
      value[key] = 0;
    }
  }

  return value;
}

function genericEmptyRecommendResponse(source) {
  const code = successCodeLike(source?.code);
  const emptyContainer = () => ({
    tabs: [],
    tabList: [],
    list: [],
    items: [],
    cards: [],
    floors: [],
    floorList: [],
    products: [],
    productList: [],
    skuList: [],
    wareInfoList: [],
    recommendList: [],
    hasMore: false,
  });

  return {
    code,
    success: true,
    message: "",
    data: emptyContainer(),
    result: emptyContainer(),
    response: emptyContainer(),
    tabs: [],
    tabList: [],
    list: [],
    items: [],
    wareInfoList: [],
    recommendList: [],
    hasMore: false,
  };
}

function cleanMessageRecommendations(object) {
  const state = { arrayCount: 0 };
  const cleaned = emptyRecommendationCollections(object, state);

  // 正常响应沿用真实字段结构，仅把所有推荐集合清空。
  if (state.arrayCount > 0) {
    markSuccess(cleaned);
    return cleaned;
  }

  // 若京东返回错误或结构改变，提供一个成功的通用空响应，避免组件展示“网络连接有问题”。
  return genericEmptyRecommendResponse(object);
}

function transform(object) {
  if (
    url.includes("functionId=deliverLayer") ||
    url.includes("functionId=orderTrackBusiness")
  ) {
    removeKeys(object, ["bannerInfo"]);
    if (Array.isArray(object?.floors)) {
      object.floors = object.floors.filter(
        (floor) => !["banner", "jdDeliveryBanner"].includes(floor?.mId)
      );
    }
  } else if (url.includes("functionId=getTabHomeInfo")) {
    removeKeys(object?.result, ["iconInfo", "roofTop"]);
  } else if (url.includes("functionId=myOrderInfo")) {
    object.floors = cleanOrderFloors(object?.floors);
  } else if (url.includes("functionId=personinfoBusiness")) {
    object.floors = cleanPersonFloors(object?.floors);
    if (object?.others) object.others.floors = cleanPersonFloors(object.others.floors);
  } else if (url.includes("functionId=start")) {
    if (Array.isArray(object?.images)) object.images = [];
    if (Object.prototype.hasOwnProperty.call(object, "showTimesDaily")) {
      object.showTimesDaily = 0;
    }
  } else if (url.includes("functionId=uniformRecommend9")) {
    return cleanMessageRecommendations(object);
  } else if (url.includes("functionId=welcomeHome")) {
    const typesToRemove = new Set([
      "bottomXview",
      "float",
      "photoCeiling",
      "ruleFloat",
      "searchIcon",
      "tabBarAtmosphere",
    ]);
    if (Array.isArray(object?.floorList)) {
      object.floorList = object.floorList.filter(
        (floor) => !typesToRemove.has(floor?.type)
      );
    }
    if (Array.isArray(object?.webViewFloorList)) object.webViewFloorList = [];
  }

  return object;
}

try {
  if (!$response?.body) {
    $done({});
  } else {
    const object = JSON.parse($response.body);
    $done({ body: JSON.stringify(transform(object)) });
  }
} catch (error) {
  console.log(`[京东去广告] 响应处理失败: ${String(error)}`);
  $done({});
}
