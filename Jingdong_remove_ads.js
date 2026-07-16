// 京东标准版响应净化
// 保持 RuCu6 jingdong.js 的单脚本、URL 直接分支写法。

const url = $request.url;
const settings =
  typeof $argument === "undefined"
    ? []
    : String($argument).replace(/[\[\]\s]/g, "").split(",");
const enabled = (index) => settings.length === 0 || settings[index] !== "false";
const rawRequestBody =
  typeof $request.body === "string" ? $request.body : "";
let decodedRequestBody = rawRequestBody;
try {
  decodedRequestBody = decodeURIComponent(rawRequestBody);
} catch (_) {}
const requestContext = `${rawRequestBody}\n${decodedRequestBody}`;

const clearRecommendResponse = (obj) => {
  if (Array.isArray(obj?.wareInfoList)) obj.wareInfoList = [];
  if (Array.isArray(obj?.tabs)) obj.tabs = [];
  if (obj?.tabTnInfo) obj.tabTnInfo = {};
  if (Object.prototype.hasOwnProperty.call(obj, "adIds")) obj.adIds = "";
  if (Object.prototype.hasOwnProperty.call(obj, "title")) delete obj.title;
  if (Object.prototype.hasOwnProperty.call(obj, "dmTitle")) delete obj.dmTitle;
};

if (!$response.body) {
  $done({});
} else {
  let obj = JSON.parse($response.body);

  if (
    enabled(4) &&
    (url.includes("functionId=deliverLayer") ||
      url.includes("functionId=orderTrackBusiness"))
  ) {
    // 物流页面：优惠横幅。
    if (obj?.bannerInfo) delete obj.bannerInfo;
    if (obj?.floors?.length > 0) {
      obj.floors = obj.floors.filter(
        (floor) => !["banner", "jdDeliveryBanner"].includes(floor?.mId)
      );
    }
  } else if (enabled(3) && url.includes("functionId=getTabHomeInfo")) {
    // 新品页面：悬浮动图、下拉二楼。
    if (obj?.result?.iconInfo) delete obj.result.iconInfo;
    if (obj?.result?.roofTop) delete obj.result.roofTop;
  } else if (enabled(4) && url.includes("functionId=myOrderInfo")) {
    // 订单页面：横幅、常购推荐、PLUS 推广和精选特惠。
    const cleanOrderFloors = (floors) => {
      if (!Array.isArray(floors)) return floors;

      let newFloors = [];
      for (let floor of floors) {
        if (
          [
            "async_circleTopicFloor",
            "async_taro_contentGrassUpFloor",
            "bannerFloor",
            "bpDynamicFloor",
            "plusFloor"
          ].includes(floor?.mId)
        ) {
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
      return newFloors;
    };

    // 旧版位于根节点；734 抓包中的新版位于 data.floors。
    obj.floors = cleanOrderFloors(obj?.floors);
    if (obj?.data) obj.data.floors = cleanOrderFloors(obj.data.floors);
  } else if (enabled(4) && url.includes("functionId=queryFloorDetailInfo")) {
    // 订单详情页：内容种草、PLUS 和专属权益楼层。
    const removeFloorIds = [
      "async_circleTopicFloor",
      "async_recommendFloor",
      "async_taro_contentGrassUpFloor",
      "bpDynamicFloor",
      "plusFloor"
    ];
    if (obj?.floors?.length > 0) {
      obj.floors = obj.floors.filter((floor) => {
        return (
          !removeFloorIds.includes(floor?.mId) &&
          floor?.data?.title !== "搭配推荐"
        );
      });
    }
    if (obj?.data?.floors?.length > 0) {
      obj.data.floors = obj.data.floors.filter((floor) => {
        return (
          !removeFloorIds.includes(floor?.mId) &&
          floor?.data?.title !== "搭配推荐"
        );
      });
    }
  } else if (enabled(4) && url.includes("functionId=newPurchaseWareCheck")) {
    // 订单列表中的“我的常购”。
    if (Object.prototype.hasOwnProperty.call(obj, "purchaseOrder")) {
      delete obj.purchaseOrder;
    }
    if (Object.prototype.hasOwnProperty.call(obj, "hitOrderHighPriceNewStyle")) {
      obj.hitOrderHighPriceNewStyle = 0;
    }
  } else if (enabled(4) && url.includes("functionId=getGiftBuyEntryInfo")) {
    // 订单页右上角礼物入口：抓包只确认了 newMyOrder，属于尝试项。
    if (Object.prototype.hasOwnProperty.call(obj, "newMyOrder")) {
      obj.newMyOrder = false;
    }
    if (obj?.data && Object.prototype.hasOwnProperty.call(obj.data, "newMyOrder")) {
      obj.data.newMyOrder = false;
    }
  } else if (enabled(5) && url.includes("functionId=personinfoBusiness")) {
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

        if (floor?.mId === "marketTNFloorNew") {
          const tnData = floor?.data?.tnData;

          // 734 抓包：nodes 是钱包/京东服务/互动游戏整块；
          // cardListStatic 是抽奖开红包。保留行为统计和物流卡片。
          if (Array.isArray(tnData?.nodes) || Array.isArray(tnData?.cardListStatic)) {
            continue;
          }

          // 头像卡右侧的学生会员推广，保留头像、会员等级等账户信息。
          if (tnData?.concisePlusInfo) delete tnData.concisePlusInfo;
          // 左上角“点评 每日签到”滚动快讯。
          if (tnData?.newsInfo) delete tnData.newsInfo;
        } else if (floor?.mId === "basefloorinfo") {
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
  } else if (enabled(0) && url.includes("functionId=start")) {
    // 开屏广告。
    if (obj?.images?.length > 0) obj.images = [];
    if (Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) {
      obj.showTimesDaily = 0;
    }
  } else if (
    (enabled(1) || enabled(8)) &&
    url.includes("functionId=welcomeHome")
  ) {
    // 首页基础浮层，以及可单独控制的运营活动板块。
    let removeTypes = [];
    if (enabled(1)) {
      removeTypes.push(
        "bottomXview",
        "float",
        "photoCeiling",
        "ruleFloat",
        "searchIcon",
        "tabBarAtmosphere",
        "topRotate"
      );
    }
    if (enabled(8)) removeTypes.push("dynamicIcon", "hybrid");

    if (obj?.floorList?.length > 0) {
      obj.floorList = obj.floorList.filter(
        (floor) => !removeTypes.includes(floor?.type)
      );
    }
    if (enabled(1)) {
      if (obj?.webViewFloorList?.length > 0) obj.webViewFloorList = [];
      if (obj?.promotionTabs) delete obj.promotionTabs;
    }
  } else if (enabled(6) && url.includes("functionId=clickRecommend")) {
    // 搜索结果中使用独立 Taro 模板渲染的 AI 推荐卡。
    if (obj?.data?.length > 0) {
      obj.data = obj.data.filter(
        (item) => !(item?.insertBizData && item?.tnTemplate)
      );
    }
  } else if (enabled(6) && url.includes("functionId=hotSearchTerms")) {
    // 734 抓包中首页顶部“作业帮”商业热词。
    if (obj?.data?.length > 0) {
      for (let group of obj.data) {
        if (!Array.isArray(group?.hotSearchContent)) continue;
        group.hotSearchContent = group.hotSearchContent.filter((item) => {
          const text = [item?.iconText, item?.title, item?.showWord]
            .filter(Boolean)
            .join(" ");
          return !text.includes("作业帮");
        });
      }
    }
  } else if (
    enabled(7) &&
    url.includes("functionId=querySmallVideoWindow")
  ) {
    // 商品页右上角自动出现的小视频窗口。
    if (obj?.result?.contents?.length > 0) obj.result.contents = [];
  } else if (
    (enabled(9) || enabled(11)) &&
    url.includes("functionId=wareBusiness")
  ) {
    if (enabled(11)) {
      // 商品主图“AI 使用说明”及相关 AIGC 入口。
      const data = obj?.commonBaseInfo?.data;
      if (data) {
        if (Object.prototype.hasOwnProperty.call(data, "aigcFlag")) {
          data.aigcFlag = false;
        }
        if (Object.prototype.hasOwnProperty.call(data, "aigcFlagV2")) {
          data.aigcFlagV2 = false;
        }
        if (data.aigcFloorId) delete data.aigcFloorId;
        if (data.aigcBizInfo) delete data.aigcBizInfo;
        if (data?.daJiaPing?.floorQoList?.length > 0) {
          for (let item of data.daJiaPing.floorQoList) {
            if (Object.prototype.hasOwnProperty.call(item, "aiOverview")) {
              item.aiOverview = "0";
            }
          }
        }
      }
      for (let floor of obj?.floors || []) {
        if (floor?.data?.extMap?.mainPicAigcInfo) {
          delete floor.data.extMap.mainPicAigcInfo;
        }
      }
    }

    if (enabled(9)) {
      // 商品详情页非核心推广楼层；该开关默认关闭。
      const removeFloorIds = [
        "ActivityFloor",
        "bpAskCommunity",
        "bpGiveGifts",
        "bpdarenping14",
        "cardBenefitLx",
        "preferenceMore"
      ];
      if (obj?.floors?.length > 0) {
        obj.floors = obj.floors.filter(
          (floor) => !removeFloorIds.includes(floor?.mId)
        );
      }
    }
  } else if (enabled(11) && url.includes("functionId=queryEvaluateFloors")) {
    // 评价页“AI 全网评”，保留普通评价、标签和晒单。
    const result = obj?.result;
    if (result && typeof result === "object") {
      for (let section of Object.values(result)) {
        if (!section || typeof section !== "object") continue;
        if (Object.prototype.hasOwnProperty.call(section, "AIcomment")) {
          section.AIcomment = "0";
        }
        if (section.aiCommentInfo) delete section.aiCommentInfo;
        if (section?.commentIconInfo?.aiTitleIcon) {
          delete section.commentIconInfo.aiTitleIcon;
        }
        if (section?.commentIconInfo?.darkAiTitleIcon) {
          delete section.commentIconInfo.darkAiTitleIcon;
        }
        for (let listName of ["semanticTagList", "tagStatisticsinfoList"]) {
          for (let item of section?.[listName] || []) {
            if (item?.aiCommentInfo) delete item.aiCommentInfo;
          }
        }
      }
    }
  } else if (
    enabled(10) &&
    url.includes("functionId=uniformRecommend6")
  ) {
    // 738 抓包：uniformRecommend6 仅用于购物车 source=6 推荐商品流。
    clearRecommendResponse(obj);
  } else if (url.includes("functionId=uniformRecommend")) {
    const isOrderRecommend =
      requestContext.includes("JDOrderTest_p_detail") ||
      requestContext.includes("JDOrderTest_p_orderlist") ||
      ["2338", "4262"].includes(String(obj?.adIds || ""));
    const isMessageRecommend =
      requestContext.includes("NavigationBar_DeployButton") ||
      requestContext.includes('"source":101') ||
      String(obj?.adIds || "") === "50840" ||
      (Array.isArray(obj?.tabs) && obj?.tabTnInfo);

    if ((enabled(4) && isOrderRecommend) || (enabled(12) && isMessageRecommend)) {
      clearRecommendResponse(obj);
    }
  } else if (enabled(2) && url.includes("functionId=readCustomSurfaceList")) {
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
  }

  $done({ body: JSON.stringify(obj) });
}
