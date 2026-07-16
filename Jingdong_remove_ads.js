// 京东标准版分类净化脚本。
// 不处理消息页推荐，不包含历史比价功能。

const url = $request.url;

function removeKeys(object, keys) {
  if (!object || typeof object !== "object") return;
  for (const key of keys) delete object[key];
}

function emptyRequestWithSuccess() {
  const body = JSON.stringify({
    code: "0",
    success: true,
    message: "",
    data: [],
    result: [],
  });

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
      },
      body,
    },
  });
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
  "newCardFloor",
  "newStyleAttentionCard",
  "newsFloor",
  "noticeFloor",
  "recommendfloor",
  "simpleCardFloor",
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

function cleanBasicConfig(object) {
  const data = object?.data;
  if (!data) return object;

  const socketMonitor = data?.JDMessage?.socketmonitor;
  if (socketMonitor) {
    socketMonitor.isSocketEstablishedAhead = 0;
    socketMonitor.isSocketReport = 0;
  }

  const httpDns = data?.JDHttpToolKit?.httpdns;
  if (httpDns) httpDns.httpdns = 0;

  return object;
}

function cleanBottomTabs(object) {
  const allowed = new Set(["index", "messagenew", "cart", "home"]);
  const modeMap = object?.result?.modeMap;

  for (const mode of ["dark", "normal"]) {
    const navigation = modeMap?.[mode]?.navigationAll;
    if (Array.isArray(navigation)) {
      modeMap[mode].navigationAll = navigation.filter((item) =>
        allowed.has(item?.functionId)
      );
    }
  }

  return object;
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
  } else if (url.includes("functionId=getGiftBuyEntryInfo")) {
    if (Object.prototype.hasOwnProperty.call(object, "newMyOrder")) {
      object.newMyOrder = false;
    }
    if (
      object?.data &&
      Object.prototype.hasOwnProperty.call(object.data, "newMyOrder")
    ) {
      object.data.newMyOrder = false;
    }
  } else if (url.includes("functionId=personinfoBusiness")) {
    object.floors = cleanPersonFloors(object?.floors);
    if (object?.others) object.others.floors = cleanPersonFloors(object.others.floors);
  } else if (url.includes("functionId=start")) {
    if (Array.isArray(object?.images)) object.images = [];
    if (Object.prototype.hasOwnProperty.call(object, "showTimesDaily")) {
      object.showTimesDaily = 0;
    }
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
    removeKeys(object, ["promotionTabs"]);
  } else if (url.includes("functionId=readCustomSurfaceList")) {
    return cleanBottomTabs(object);
  } else if (url.includes("functionId=cart")) {
    removeKeys(object?.cartLocationMap, ["loc_emptyCartFloor2"]);
    removeKeys(object, ["emptyCartRecommendFloor"]);
  } else if (url.includes("functionId=basicConfig")) {
    return cleanBasicConfig(object);
  }

  return object;
}

try {
  if (typeof $response === "undefined") {
    emptyRequestWithSuccess();
  } else if (!$response?.body) {
    $done({});
  } else {
    const object = JSON.parse($response.body);
    $done({ body: JSON.stringify(transform(object)) });
  }
} catch (error) {
  console.log(`[京东净化] 处理失败: ${String(error)}`);
  $done({});
}
