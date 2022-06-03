const pacLink = localStorage.pacLink || ""
let result = ""
if(pacLink.length > 0)
  result = biliBridgePc.callNativeSync('config/roamingPAC', pacLink);
if(result === 'error')localStorage.pacLink = ""
console.log("====HOOK===PLAYER====");

(()=>{

  const HTTP = {
    get(url) {
      return new Promise((resolve, reject) => {
        const Http = new XMLHttpRequest()
        Http.open('GET', url)
        Http.send()
        Http.onloadend = e => {
          resolve(Http)
        }
        Http.onerror = e => reject
      })
    }
  }
  const BilibiliAPI = {
    getEpDetails: (seasonId, epId)=>{
      const api = new BiliBiliApi()
      return api.getSeasonInfoByEpSsIdOnBangumi(epId || "", seasonId || "")
      .then(seasonInfo=>{
        console.log('seasonInfo: ', seasonInfo)
        if(seasonInfo.code !==0)return Promise.reject(seasonInfo)

        const ep = seasonInfo.result.episodes.filter(ep=>ep.ep_id===epId)
        if(ep.length === 0)return Promise.reject("剧集查找失败")
        return Promise.resolve(ep[0])
      })
    }
  }
  const DandanAPI = {
    getComment(epId, withRelated=false){
      const url = `https://api.acplay.net/api/v2/comment/${epId}?withRelated=${withRelated}`
      return HTTP.get(url).then(res=>{
        const resp = JSON.parse(res.responseText || "{}")
        return Promise.resolve(resp.comments || [])
      })
    }
  }
  const SearchAPI = {
    bilibili: (str)=>{
      const url = `http://api.bilibili.com/x/web-interface/search/type?keyword=${str}&search_type=media_bangumi`
      return HTTP.get(url).then(res=>{
        const resp = JSON.parse(res.responseText)
        console.log('bilibili: ', resp)
        const bangumiList = []
        const result = resp.data?.result ?? []
        console.log('result: ', result)
        for(let bangumi of result){
          let children = []
          for(let ep of bangumi.eps){
            const title = ep.title.length < 5 ? `${ep.title}-${ep.long_title.replace(/<.*?>/g, '')}` : ep.title.replace(/<.*?>/g, '')
            children.push({
              label: title,
              value: ep.id
            })
          }
          bangumiList.push({
            label: bangumi.title.replace(/<.*?>/g, ''),
            value: bangumi.pgc_season_id,
            children
          })
        }
        return Promise.resolve(bangumiList)
      })
    },
    dandanplay: (str)=>{
      const url = `https://api.acplay.net/api/v2/search/episodes?anime=${str}`
      return HTTP.get(url).then(res=>{
        const resp = JSON.parse(res.responseText)
        console.log('dandanplay: ', resp)
        const bangumiList = []
        const result = resp?.animes ?? []
        console.log('dandanplay result: ', result)
        for(let anime of result){
          let children = []
          for(let ep of anime.episodes){
            children.push({
              label: ep.episodeTitle,
              value: ep.episodeId
            })
          }
          bangumiList.push({
            label: anime.animeTitle,
            value: anime.animeId,
            children
          })
        }
        return Promise.resolve(bangumiList)
      })
    }
  }
  const HandleResult = {
    bilibili: async (options)=>{
      console.log('bilibili options: ', options)
      const epDetails = await BilibiliAPI.getEpDetails(...options)
      console.log('getEpDetails: ', epDetails)

      // 弹幕池操作
      danmakuManage.rootStore.configStore.reload.cid = epDetails.cid
      // danmakuManage.rootStore.configStore.reload.aid = epDetails.aid
      danmakuManage.danmaku.danmakuArray = []
      danmakuManage.danmaku.clear()
      danmakuManage.danmakuStore.loadDmPbAll(true)
      return Promise.resolve("操作成功")
    },
    dandanplay: async (options, data)=>{
      console.log('dandanplay options: ', options)
      const comments = await DandanAPI.getComment(options[1], data.dandanplayWithRelated || true)
      console.log('getComment: ', comments)
      const result = []
      const nowTime = new Date().getTime()/1000
      for(let comment of comments){
        const p = comment.p.split(',')
        // 出现时间,模式,颜色,用户ID
        const time = parseFloat(p[0])
        const mode = parseInt(p[1])
        const color = parseInt(p[2])
        result.push({
          attr: -1,
          color,
          date: nowTime,
          mode,
          pool: 0,
          renderAs: 1,
          size: 25,
          text: comment.m,
          stime: time,
          weight: 1,
        })
      }
      /**
       * attr: -1
        color: 16777215
        date: 1653221671
        dmid: "1058059079576006912"
        effect: {}
        mode: 1
        pool: 0
        renderAs: 1
        size: 25
        stime: 8.295
        text: "好！"
        uhash: "c515e33f"
        weight: 1
       */
      // 弹幕池操作
      danmakuManage.danmaku.reset()
      if(data.actionMode === "1")
      danmakuManage.danmaku.danmakuArray = []
      danmakuManage.danmaku.addAll(result)
      danmakuManage.danmaku.clear()
      // danmakuManage.danmakuStore.loadDmPbAll(true)
      
      return Promise.resolve(`成功加载${comments.length}条弹幕`)
    }
  }
  const UI = (()=>{
    const init = ()=>{
      console.log("init")
      const appContainer = document.querySelector("#app > div > div.app_player--content.flex_end.ov_hidden")
      const page = document.createElement('div')
      page.className = "msojocs-player-settings"
      page.id = "msojocs-player-settings"
      page.style.display = "none"
      appContainer.appendChild(page)
      const loadStatus = document.createElement('span')
      loadStatus.style.color = "red"
      loadStatus.style.fontSize = "xxx-large"
      page.appendChild(loadStatus)

      function createVueJS() {
        let ele = document.createElement('script');
        ele.src = "https://lib.baomitu.com/vue/3.2.31/vue.global.prod.min.js";
        return ele
      }
    
      function createElementPlusJS() {
        let ele = document.createElement('script');
        ele.src = "https://lib.baomitu.com/element-plus/2.2.0/index.full.min.js";
        return ele
      }
      let vue = createVueJS()
      loadStatus.textContent = "[1/2]加载vue"
      vue.onerror = (e) => {
        const reload = document.createElement('button')
        reload.textContent = "重载vue"
        reload.className = "vui_button about-button mr_sm"
        reload.onclick = () => {
          vue.remove()
          let vueNew = createVueJS()
          vueNew.onload = vue.onload
          vueNew.onerror = vue.onerror
          page.prepend(vueNew)
          reload.remove()
        }
        loadStatus.append(reload)
      }
      page.prepend(vue)
    
      let ele = createElementPlusJS()
      ele.onerror = () => {
        const reload = document.createElement('button')
        reload.textContent = "重载ele"
        reload.className = "vui_button about-button mr_sm"
        reload.onclick = function () {
          ele.remove()
          let eleNew = createElementPlusJS()
          eleNew.onload = ele.onload
          eleNew.onerror = ele.onerror
          reload.remove()
          page.prepend(eleNew)
        }
    
        loadStatus.children.length === 0 && loadStatus.append(reload)
      }
      vue.onload = (e) => {
        loadStatus.textContent = "[2/2]加载element-plus"
        loadStatus.children.length === 1 && loadStatus.children[0].remove()
        ele.onerror()
        page.prepend(ele)
      }
    
      document.addEventListener('ROAMING_sendURL', async function (e) {
        // e.detail contains the transferred data (can be anything, ranging
        // from JavaScript objects to strings).
        // Do something, for example:
        console.log('ROAMING_sendURL: ', e.detail);
        if(e.detail.includes("PlayerEnhance")){
          const roamingHTML = await HTTP.get(e.detail)
          const container = document.createElement('div')
      
          container.innerHTML = roamingHTML.responseText
          ele.onload = () => {
            loadStatus.textContent = ""
            page.className = ""
            loadPage()
          }
          page.appendChild(container)
        }
      });
      document.dispatchEvent(new CustomEvent('ROAMING_getURL', {
        detail: 'PlayerEnhance' // Some variable from Gmail.
      }));
    }
    let changeShow = ()=>{
      const page = document.getElementById("msojocs-player-settings")
      if(page){
        page.style.display = page.style.display === "none" ? "" : "none"
      }
    }
    const loadPage = ()=>{
      console.log("Vue Start")
      const App = {
        data() {
          return {
            activeName: "bilibili",
            searchStr: "",
            searchResult: [],
            selectOptions: null,
            settingsVisible: false,
            damakuMode: "1",
            dmTimelineDrawer: false,
            moveFactor: 0,
            dandanplayWithRelated: true,
          };
        },
        created() {
          console.log('vue created')
          document.getElementById("player-ext-settings").onclick = ()=>{
            this.settingsVisible = !this.settingsVisible
          }
          this.settingsVisible = document.getElementById("msojocs-player-settings").style.display !== "none"
          document.getElementById("msojocs-player-settings").style.display = ""
          UI.dmTimeline = ()=>{
            this.dmTimelineDrawer = !this.dmTimelineDrawer
          }
        },
        methods: {
          doSearch: function(){
            SearchAPI[this.activeName](this.searchStr)
            .then(resp=>{
              this.searchResult = resp || []
            })
          },
          doConfirm: function(){
            console.log('selectOptions', this.selectOptions)
            let data = {}
            switch (this.activeName) {
              case "dandanplay":
                data.damakuMode = this.damakuMode
                data.dandanplayWithRelated = this.dandanplayWithRelated
                break;
            
              default:
                break;
            }
            HandleResult[this.activeName](this.selectOptions, data)
            .then(res=>{
              this.$message({
                message: res,
                type: 'success'
              })
            }).catch(err=>{

              this.$message({
                message: "出现错误",
                type: 'error'
              })
            })
            this.settingsVisible = !this.settingsVisible
          },
          dmTimelineMove: function(time){
            this.moveFactor += time
            console.log('dmTimelineMove: ', time, this.moveFactor)
            const danmaku = danmakuManage.danmaku
            danmaku.seek(danmaku.time/1000 + this.moveFactor, true)
          }
        }
      };
      const app = Vue.createApp(App);
      app.use(ElementPlus);
      app.mount("#player-settings-ext");
    }
    return {
      init,
      changeShow,
    }
  })()

  window.onload = ()=>{
    console.log("====onload====")
    const headerLeft = document.querySelector("#app > div > div.app_player--header.flex_between.draggable > div.app_player--header-left.mt_2")

    // 创建菜单元素
    const playerExtPage = document.createElement('span')
    playerExtPage.innerHTML = `<svg width="26" height="26" style="margin-right:5px" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1305" width="200" height="200"><path d="M1023.8 604.7c0 160.9-129 291.3-287.9 291.3H256.1C113.3 888.5 0.2 781.3 0.2 650.7c0-99.4 65.6-185 159.9-223.5 19.7-8 33.8-25.5 38.2-46.3C224.9 254.9 340.8 160 480 160c102.6 0 192.4 51.5 243.4 129 10 15.3 26.1 25.5 44.2 28.2 145.2 22 256.2 142.1 256.2 287.5z" p-id="1306" fill="#ffffff"></path></svg>弹幕Ext`
    playerExtPage.id = "player-ext-settings"
    playerExtPage.className = "app_player--header-home no_drag"
    playerExtPage.onclick = ()=>{
      UI.changeShow()
    }
    headerLeft.appendChild(playerExtPage)
    const dmTimeline = document.createElement('span')
    dmTimeline.innerHTML = `<svg  width="26" height="26" style="margin-right:5px"fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.25 13c.966 0 1.75.783 1.75 1.75v4.503a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 19.253V14.75c0-.967.783-1.75 1.75-1.75h11.5ZM21 14.895v5.355a.75.75 0 0 1-1.494.102l-.006-.102v-5.344a3.003 3.003 0 0 0 1.5-.01Zm-.75-4.803a1.908 1.908 0 1 1 0 3.816 1.908 1.908 0 0 1 0-3.816Zm-5.005-7.095c.967 0 1.75.783 1.75 1.75V9.25a1.75 1.75 0 0 1-1.75 1.75h-11.5a1.75 1.75 0 0 1-1.75-1.75V4.747a1.75 1.75 0 0 1 1.607-1.745l.143-.005h11.5ZM20.25 3a.75.75 0 0 1 .743.648L21 3.75v5.345a3.004 3.004 0 0 0-1.5-.01V3.75a.75.75 0 0 1 .75-.75Z" fill="#ffffff" class="fill-212121"></path></svg>弹幕时间轴`
    dmTimeline.style.marginLeft = "5px"
    // dmTimeline.id = "player-timeline-settings"
    dmTimeline.className = "app_player--header-home no_drag"
    dmTimeline.onclick = ()=>{
      UI.dmTimeline && UI.dmTimeline()
    }
    headerLeft.appendChild(dmTimeline)
    UI.init()
    // 添加按钮到页面

  }
  // 1.75倍速
  let rate175check = setInterval(()=>{
    // console.log('1.75倍速')
    try{
      const speedRate = window.danmakuManage.nodes.controlBottomRight.querySelector('.cpx-player-ctrl-playbackrate-menu > li:nth-child(1)')
      const rate175 = document.createElement('li')
      rate175.className = "cpx-player-ctrl-playbackrate-menu-item"
      rate175.dataset.value = "1.75"
      rate175.textContent = "1.75x"
      speedRate.after(rate175)
      clearInterval(rate175check)
    }catch(err){
      // console.error('添加1.75倍速失败：', err)
    }
  }, 1000)
})()