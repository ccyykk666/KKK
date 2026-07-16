// 京东标准版响应净化
// 写法参考 RuCu6 的 jingdong.js：按 URL 直接分支并修改响应 JSON。

const url = $request.url;

if (!$response.body) {
  $done({});
} else {
  let obj = JSON.parse($response.body);

  if (
    url.includes("functionId=deliverLayer") ||
    url.includes("functionId=orderTrackBusiness")
  ) {
    // 物流页面：优惠横幅。
    if (obj?.bannerInfo) delete obj.bannerInfo;
    if (obj?.floors?.length > 0) {
      obj.floors = obj.floors.filter(
        (floor) => !["banner", "jdDeliveryBanner"].includes(floor?.mId)
      );
    }
  } else if (url.includes("functionId=getTabHomeInfo")) {
    // 新品页面：悬浮动图、下拉二楼。
    if (obj?.result?.iconInfo) delete obj.result.iconInfo;
    if (obj?.result?.roofTop) delete obj.result.roofTop;
  } else if (url.includes("functionId=myOrderInfo")) {
    // 订单页面：横幅、常购推荐、PLUS 推广和精选特惠。
    if (obj?.floors?.length > 0) {
      let newFloors = [];
      for (let floor of obj.floors) {
        if (["bannerFloor", "bpDynamicFloor", "plusFloor"].includes(floor?.mId)) {
          continue;
        }

        if (floor?.mId === "virtualServiceCenter") {
          const centers = floor?.data?.virtualServiceCenters;
          if (centers?.length > 0) {
            for (let center of centers) {
              if (center?.serviceList?.length > 0) {
                center.serviceList = center.serviceList.filter(
                  (card) => card?.serviceTitle !== "精选特惠"
                );
              }
            }
          }
        }

        if (floor?.mId === "customerServiceFloor" && floor?.data?.moreText) {
          if (floor.data.moreIcon) delete floor.data.moreIcon;
          if (floor.data.moreIcon_dark) delete floor.data.moreIcon_dark;
          floor.data.moreText = " ";
        }

        newFloors.push(floor);
      }
      obj.floors = newFloors;
    }
  } else if (url.includes("functionId=getGiftBuyEntryInfo")) {
    // 订单页右上角礼物入口：抓包只确认了 newMyOrder，属于尝试项。
    if (Object.prototype.hasOwnProperty.call(obj, "newMyOrder")) {
      obj.newMyOrder = false;
    }
    if (obj?.data && Object.prototype.hasOwnProperty.call(obj.data, "newMyOrder")) {
      obj.data.newMyOrder = false;
    }
  } else if (url.includes("functionId=personinfoBusiness")) {
    // “我的”页面。
    const removeFloorIds = [
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
      "simpleCardFloor"
    ];

    const cleanFloors = (floors) => {
      if (!Array.isArray(floors)) return floors;

      let newFloors = [];
      for (let floor of floors) {
        if (removeFloorIds.includes(floor?.mId)) continue;

        if (floor?.mId === "basefloorinfo") {
          if (floor?.data?.commonPopup) delete floor.data.commonPopup;
          if (floor?.data?.commonPopup_dynamic) delete floor.data.commonPopup_dynamic;
          if (floor?.data?.floatLayer) delete floor.data.floatLayer;
          if (floor?.data?.commonTips?.length > 0) floor.data.commonTips = [];
          if (floor?.data?.commonWindows?.length > 0) floor.data.commonWindows = [];
        } else if (floor?.mId === "orderIdFloor") {
          if (floor?.data?.commentRemindInfo?.infos?.length > 0) {
            floor.data.commentRemindInfo.infos = [];
          }
        } else if (floor?.mId === "userinfo") {
          if (floor?.data?.newPlusBlackCard) delete floor.data.newPlusBlackCard;
        }

        newFloors.push(floor);
      }
      return newFloors;
    };

    obj.floors = cleanFloors(obj?.floors);
    if (obj?.others) obj.others.floors = cleanFloors(obj.others.floors);
  } else if (url.includes("functionId=start")) {
    // 开屏广告。
    if (obj?.images?.length > 0) obj.images = [];
    if (Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) {
      obj.showTimesDaily = 0;
    }
  } else if (url.includes("functionId=welcomeHome")) {
    // 首页悬浮、顶部动图、下拉二楼和底部氛围图。
    const removeTypes = [
      "bottomXview",
      "float",
      "photoCeiling",
      "ruleFloat",
      "searchIcon",
      "tabBarAtmosphere",
      "topRotate"
    ];
    if (obj?.floorList?.length > 0) {
      obj.floorList = obj.floorList.filter(
        (floor) => !removeTypes.includes(floor?.type)
      );
    }
    if (obj?.webViewFloorList?.length > 0) obj.webViewFloorList = [];
    if (obj?.promotionTabs) delete obj.promotionTabs;
  } else if (url.includes("functionId=readCustomSurfaceList")) {
    // 底部导航：仅保留首页、消息、购物车、我的。
    const keepTabs = ["index", "messagenew", "cart", "home"];
    const modeMap = obj?.result?.modeMap;
    for (let mode of ["dark", "normal"]) {
      if (modeMap?.[mode]?.navigationAll?.length > 0) {
        modeMap[mode].navigationAll = modeMap[mode].navigationAll.filter(
          (item) => keepTabs.includes(item?.functionId)
        );
      }
    }
  } else if (url.includes("functionId=cart")) {
    // 购物车推荐楼层。
    if (obj?.cartLocationMap?.loc_emptyCartFloor2) {
      delete obj.cartLocationMap.loc_emptyCartFloor2;
    }
    if (obj?.emptyCartRecommendFloor) delete obj.emptyCartRecommendFloor;
  } else if (url.includes("functionId=basicConfig")) {
    // 消息 Socket 与内置 HTTPDNS。
    if (obj?.data?.JDMessage?.socketmonitor) {
      obj.data.JDMessage.socketmonitor.isSocketEstablishedAhead = 0;
      obj.data.JDMessage.socketmonitor.isSocketReport = 0;
    }
    if (obj?.data?.JDHttpToolKit?.httpdns) {
      obj.data.JDHttpToolKit.httpdns.httpdns = 0;
    }
  }

  $done({ body: JSON.stringify(obj) });
}
