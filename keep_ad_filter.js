const url = $request.url;

function cleanMyPage(obj) {
  if (!obj?.data || typeof obj.data !== "object") return;

  obj.data.floatingInfo = {};
  delete obj.data.memberInfo;
}

function cleanBasicConfig(obj) {
  const data = obj?.data;
  if (!data || typeof data !== "object") return;

  const bottomBar = data.bottomBarControl;
  if (bottomBar && typeof bottomBar === "object") {
    bottomBar.defaultTab = "home";
    if (Array.isArray(bottomBar.tabs)) {
      const allowedTabs = new Set(["home", "dynamic_sports", "personal"]);
      bottomBar.tabs = bottomBar.tabs.filter((tab) =>
        allowedTabs.has(tab?.tabType)
      );
    }
  }

  data.homeTabs = [
    {
      type: "homeRecommend",
      order: 1,
      name: "推荐",
      schema: "keep://homepage/homeRecommend",
      showInFewDays: 7,
      reverseSwitch: false,
      default: true
    },
    {
      type: "homePrime",
      order: 2,
      name: "会员",
      schema: "keep://coursepage/homePrime",
      showInFewDays: 7,
      reverseSwitch: false,
      default: false
    }
  ];
}

function cleanCourseFeed(obj) {
  const modules = obj?.data?.modules;
  if (!Array.isArray(modules)) return;

  const blockedCodes = new Set(["homepageCommonContainer", "homepageLive"]);
  obj.data.modules = modules.filter(
    (module) => !blockedCodes.has(module?.code)
  );
}

function cleanRunningAiModeEntry(obj) {
  const games = obj?.data?.games;
  if (!Array.isArray(games)) return;

  const runningTypes = new Set(["outdoorRunning", "indoorRunning"]);

  for (const game of games) {
    if (!runningTypes.has(game?.gameType) || !Array.isArray(game.microGames)) {
      continue;
    }

    for (const microGame of game.microGames) {
      if (microGame?.leftIcon?.type === "aiMode") {
        microGame.leftIcon = null;
      }
    }
  }
}

if (!$response.body) {
  $done({});
} else {
  try {
    const obj = JSON.parse($response.body);

    if (/\/athena\/v\d+\/people\/(?:encrypt\/)?my(?:\?|$)/.test(url)) {
      cleanMyPage(obj);
    } else if (/\/config\/v\d+\/basic(?:\?|$)/.test(url)) {
      cleanBasicConfig(obj);
    } else if (/\/twins\/v4\/feed\/course(?:\?|$)/.test(url)) {
      cleanCourseFeed(obj);
    } else if (/\/pencil-webapp\/play\/v1\/games(?:\?|$)/.test(url)) {
      cleanRunningAiModeEntry(obj);
    }

    $done({ body: JSON.stringify(obj) });
  } catch (error) {
    console.log(`Keep去广告：响应处理失败，放行原响应。${error}`);
    $done({});
  }
}
