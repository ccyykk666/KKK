const url = $request.url;
const originalBody = $response.body;

function clearCornerMarks(items, posKeys) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach(function (item) {
    if (item && posKeys.indexOf(item.posKey) !== -1) {
      item.cornerMarkPic = "";
    }
  });
}

try {
  const response = JSON.parse(originalBody);

  if (url.indexOf("/dxkits/aisearch/home") !== -1) {
    const data = response.data || {};
    clearCornerMarks(data.aiPageBar, ["wakeup"]);

    if (data.aiPageBarStr) {
      const isString = typeof data.aiPageBarStr === "string";
      const pageBar = isString
        ? JSON.parse(data.aiPageBarStr)
        : data.aiPageBarStr;

      clearCornerMarks(pageBar.bigDiamond, ["wakeup"]);
      clearCornerMarks(pageBar.smallDiamond, ["四六级", "刷题"]);
      data.aiPageBarStr = isString ? JSON.stringify(pageBar) : pageBar;
    }
  }

  if (url.indexOf("/dxkits/aisearch/guide") !== -1) {
    const data = response.data || {};
    data.title = "";
    data.guideInfo = { card: [] };
    data.guideList = [];
    data.guideBanner = { content: "", pic: "", btype: 0, bid: 0 };
    data.banners = [];
    data.sugConfigList = [];
    data.sugList = [];
    data.subscriptionRenewalAlert = { isShow: false };
    response.data = data;
  }

  if (url.indexOf("/dxapp/study/home") !== -1) {
    const data = response.data || {};
    if (Array.isArray(data.subjectList)) {
      data.subjectList.forEach(function (subject) {
        subject.saleActivityType = 0;
      });
    }
  }

  if (url.indexOf("/dxapp/study/annualvip") !== -1) {
    response.errNo = 0;
    response.errstr = "succ";
    response.data = { data: "" };
  }

  $done({ body: JSON.stringify(response) });
} catch (error) {
  console.log("KKK: " + error);
  $done({ body: originalBody });
}
