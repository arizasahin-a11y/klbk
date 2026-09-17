target_player_path = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\javascripts\player.js"

modern_player_js = r'''/**
 * Modernized Player for English File PREINT (Pardus / Modern Web)
 * Replaces Adobe Flash Player with:
 * - HTML5 Audio & Transcript Viewer
 * - HTML5 Video & flv.js for FLV video decoding
 * - Ruffle WebAssembly for interactive Flash SWF exercises (key.swf)
 */

var Player = {
  FLASH_VERSION: "10.1.85",
  DEFAULT_PARAMS: new Hash({
    menu: false,
    loop: false,
    allowfullscreen: true,
    allowscriptaccess: 'always',
    base: ''
  }),
  MEDIA_PLAYER_PATH: 'players/audio.swf',
  AUDIO_PLAYER_HEIGHT_SCRIPT: 373,
  AUDIO_PLAYER_HEIGHT_NOSCRIPT: 120,
  VIDEO_PLAYER_HEIGHT_SCRIPT: 586,
  VIDEO_PLAYER_HEIGHT_NOSCRIPT: 440,
  CONTAINER_OFFSET: 28,
  _player_path: null,

  normalizeUrl: function(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf("resource://") === 0) {
      return url.replace("resource://", "assets/");
    }
    return url;
  },

  useNativePlayer: function(type, path) {
    return false;
  },

  nativeVideoPath: function(fileName) {
    return this.normalizeUrl(fileName);
  },

  videoPath: function(videoPath) {
    return this.normalizeUrl(videoPath);
  },

  load: function(asset) {
    var height, width;
    var fileName = this.normalizeUrl(asset["link"] || asset["url"] || "");
    var scriptFileName = asset["script"] ? this.normalizeUrl(asset["script"]) : "";
    this._player_path = fileName;
    var onAfterLoad = Player.show;

    switch (asset.type) {
      case "audio":
        var flashvars = { 'audioVar': fileName, 'scriptVar': scriptFileName };
        height = asset['height'] || Player.AUDIO_PLAYER_HEIGHT_NOSCRIPT;
        width = asset['width'] || 480;
        this._embedAudioPlayer({
          flashvars: flashvars,
          width: width,
          height: height,
          title: asset['title'] || 'Audio Track'
        });
        break;

      case "audio-without-controls":
        var flashvars = { 'audioVar': fileName };
        height = asset['height'] || 100;
        width = asset['width'] || 100;
        this._embedAudioPlayer({
          flashvars: flashvars,
          width: width,
          height: height,
          title: asset['title'] || 'Audio Track'
        });
        onAfterLoad = function() {};
        break;

      case "video":
        var flashvars = { 'videoPath': this.videoPath(fileName), 'source': scriptFileName };
        height = asset['height'] || Player.VIDEO_PLAYER_HEIGHT_NOSCRIPT;
        width = asset['width'] || 680;
        this._embedVideoPlayer({
          flashvars: flashvars,
          width: width,
          height: height,
          title: asset['title'] || 'Video Track'
        });
        break;

      case "swf":
      case "flash":
      case "flash_interactive":
        height = asset['height'] || 560;
        width = asset['width'] || 950;
        this._embedInteractive(asset, width, height);
        break;

      case "graphic":
      case "image":
        height = asset['height'] || null;
        width = asset['width'] || null;
        this._embedGraphic(fileName, asset.title);
        break;

      case "web_link":
        height = asset['height'] || 190;
        width = asset['width'] || 300;
        this._embedWebLinkPreview(asset.title, asset.url, asset.image_url);
        break;

      default:
        if (fileName.match(/\.swf$/i)) {
          this._embedInteractive(asset, 950, 560);
        } else if (fileName.match(/\.(mp3|wav|ogg)$/i)) {
          this._embedAudioPlayer({ flashvars: { audioVar: fileName }, width: 480, height: 120 });
        } else if (fileName.match(/\.(flv|mp4|webm)$/i)) {
          this._embedVideoPlayer({ flashvars: { videoPath: fileName }, width: 680, height: 440 });
        }
        break;
    }

    this._repositionModalWindow({ 'height': height, 'width': width });
    onAfterLoad.apply(Player);
  },

  _embedAudioPlayer: function(opts) {
    var audioUrl = opts.flashvars.audioVar;
    var scriptUrl = opts.flashvars.scriptVar;
    var width = opts.width || 480;
    var title = opts.title || "Audio Track";

    var html = '<div id="modernAudioContainer" style="width:' + width + 'px;padding:16px;background:#1e222d;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.5);font-family:Segoe UI,Roboto,sans-serif;color:#e1e5ee;box-sizing:border-box;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<span style="font-size:15px;font-weight:600;letter-spacing:0.3px;">' + title + '</span>';
    if (scriptUrl) {
      html += '<button id="toggleAudioTranscript" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">Show Script</button>';
    }
    html += '</div>';

    html += '<audio id="activeModernAudio" src="' + audioUrl + '" controls autoplay style="width:100%;height:44px;outline:none;border-radius:6px;"></audio>';

    if (scriptUrl) {
      html += '<div id="modernAudioScriptBox" style="display:none;margin-top:14px;max-height:220px;overflow-y:auto;background:#13161c;padding:12px 16px;border-radius:6px;border:1px solid #2d3343;font-size:13px;line-height:1.7;color:#cbd5e1;white-space:pre-wrap;">Loading script...</div>';
    }
    html += '</div>';

    $('player').update(html);

    if (scriptUrl) {
      $('toggleAudioTranscript').observe('click', function() {
        var box = $('modernAudioScriptBox');
        var btn = $('toggleAudioTranscript');
        if (box.visible()) {
          box.hide();
          btn.update('Show Script');
        } else {
          box.show();
          btn.update('Hide Script');
          if (box.innerHTML === 'Loading script...') {
            new Ajax.Request(scriptUrl, {
              method: 'get',
              onSuccess: function(transport) {
                try {
                  var parser = new DOMParser();
                  var xmlDoc = parser.parseFromString(transport.responseText, "text/xml");
                  var cues = xmlDoc.getElementsByTagName("Cue");
                  var text = "";
                  for (var i = 0; i < cues.length; i++) {
                    var val = cues[i].textContent || cues[i].text || "";
                    if (val === "line_return") {
                      text += "\n";
                    } else {
                      text += (text.length > 0 && !text.endsWith("\n") ? " " : "") + val;
                    }
                  }
                  box.innerHTML = text.replace(/<[^>]+>/g, '');
                } catch(e) {
                  box.innerHTML = "Unable to parse script.";
                }
              },
              onFailure: function() {
                box.innerHTML = "Script could not be loaded.";
              }
            });
          }
        }
      });
    }
  },

  _embedVideoPlayer: function(opts) {
    var videoUrl = opts.flashvars.videoPath;
    var scriptUrl = opts.flashvars.source;
    var width = opts.width || 680;
    var height = opts.height || 440;
    var title = opts.title || "Video Track";

    var html = '<div id="modernVideoContainer" style="width:' + width + 'px;background:#111;border-radius:8px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.6);font-family:Segoe UI,Roboto,sans-serif;">';
    html += '<div style="position:relative;width:' + width + 'px;height:' + height + 'px;background:#000;">';
    html += '<video id="activeModernVideo" controls autoplay style="width:100%;height:100%;background:#000;outline:none;display:block;"></video>';
    html += '</div>';

    if (scriptUrl) {
      html += '<div style="padding:10px 16px;background:#1e222d;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #2d3343;">';
      html += '<span style="color:#e1e5ee;font-size:13px;font-weight:600;">' + title + '</span>';
      html += '<button id="toggleVideoTranscript" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Show Script</button>';
      html += '</div>';
      html += '<div id="modernVideoScriptBox" style="display:none;max-height:180px;overflow-y:auto;background:#13161c;padding:12px 16px;border-top:1px solid #2d3343;font-size:13px;line-height:1.7;color:#cbd5e1;white-space:pre-wrap;">Loading script...</div>';
    }
    html += '</div>';

    $('player').update(html);

    var videoEl = $('activeModernVideo');
    if (window._activeFlvPlayer) {
      try { window._activeFlvPlayer.destroy(); } catch(e){}
      window._activeFlvPlayer = null;
    }

    if (videoUrl.match(/\.flv$/i) && window.flvjs && flvjs.isSupported()) {
      try {
        var flvPlayer = flvjs.createPlayer({
          type: 'flv',
          url: videoUrl
        });
        flvPlayer.attachMediaElement(videoEl);
        flvPlayer.load();
        flvPlayer.play();
        window._activeFlvPlayer = flvPlayer;
      } catch(err) {
        console.error("flv.js playback failed:", err);
        videoEl.src = videoUrl;
      }
    } else {
      videoEl.src = videoUrl;
    }

    if (scriptUrl) {
      $('toggleVideoTranscript').observe('click', function() {
        var box = $('modernVideoScriptBox');
        var btn = $('toggleVideoTranscript');
        if (box.visible()) {
          box.hide();
          btn.update('Show Script');
        } else {
          box.show();
          btn.update('Hide Script');
          if (box.innerHTML === 'Loading script...') {
            new Ajax.Request(scriptUrl, {
              method: 'get',
              onSuccess: function(transport) {
                try {
                  var parser = new DOMParser();
                  var xmlDoc = parser.parseFromString(transport.responseText, "text/xml");
                  var cues = xmlDoc.getElementsByTagName("Cue");
                  var text = "";
                  for (var i = 0; i < cues.length; i++) {
                    var val = cues[i].textContent || cues[i].text || "";
                    if (val === "line_return") {
                      text += "\n";
                    } else {
                      text += (text.length > 0 && !text.endsWith("\n") ? " " : "") + val;
                    }
                  }
                  box.innerHTML = text.replace(/<[^>]+>/g, '');
                } catch(e) {
                  box.innerHTML = "Unable to parse script.";
                }
              },
              onFailure: function() { box.innerHTML = "Script could not be loaded."; }
            });
          }
        }
      });
    }
  },

  _embedInteractive: function(asset, width, height) {
    var swfUrl = this.normalizeUrl(asset.link || asset.url || asset.fileName || "");
    width = width || 950;
    height = height || 560;

    var containerHtml = '<div id="ruffleContainer" style="width:' + width + 'px;height:' + height + 'px;background:#ffffff;border-radius:8px;overflow:hidden;position:relative;display:flex;justify-content:center;align-items:center;"></div>';
    $('player').update(containerHtml);

    var container = $('ruffleContainer');

    if (window.RufflePlayer) {
      try {
        var ruffle = window.RufflePlayer.newest();
        var rufflePlayer = ruffle.createPlayer();
        rufflePlayer.style.width = width + "px";
        rufflePlayer.style.height = height + "px";
        container.appendChild(rufflePlayer);
        rufflePlayer.load({
          url: swfUrl,
          allowScriptAccess: true,
          parameters: asset.flashvars || {}
        });
        window._activeRufflePlayer = rufflePlayer;
      } catch(e) {
        console.error("Ruffle embed failed, fallback to embed tag:", e);
        container.update('<embed src="' + swfUrl + '" width="' + width + '" height="' + height + '" type="application/x-shockwave-flash">');
      }
    } else {
      container.update('<embed src="' + swfUrl + '" width="' + width + '" height="' + height + '" type="application/x-shockwave-flash">');
    }
  },

  _embedGraphic: function(link, title) {
    var imgUrl = this.normalizeUrl(link);
    var newImage = document.createElement('img');
    newImage.id = 'new-img-to-load';
    newImage.src = imgUrl;
    newImage.onload = function() {
      var maxHeight = 600;
      var maxWidth = 800;
      var h = newImage.height;
      var w = newImage.width;
      if (h > maxHeight) {
        w = Math.round(w * (maxHeight / h));
        h = maxHeight;
      }
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }
      var content = '<img src="' + imgUrl + '" title="' + (title || '') + '" width="' + w + '" height="' + h + '" style="border-radius:6px;display:block;max-width:100%;max-height:100%;" />';
      Player._repositionModalWindow({ 'height': h, 'width': w });
      $('player').update(content);
      Player.show();
    };
  },

  _embedWebLinkPreview: function(title, url, imageUrl) {
    url = url || '#';
    window.open(url, '_blank');
  },

  _repositionModalWindow: function(opts) {
    var modal = $('modal-content');
    if (!modal) return;
    var viewport = document.viewport.getDimensions();
    var width = opts.width || 600;
    var height = opts.height || 400;

    var left = Math.max(10, Math.floor((viewport.width - width) / 2));
    var top = Math.max(20, Math.floor((viewport.height - height) / 2));

    modal.setStyle({
      width: (width + 30) + 'px',
      left: left + 'px',
      top: top + 'px'
    });
  },

  show: function() {
    var modal = $('modal-content');
    if (modal) {
      modal.show();
    }
    if ($('dock')) {
      var shield = $('dock').down('li.shield');
      if (shield) shield.show();
    }
  },

  hide: function() {
    var audio = $('activeModernAudio');
    if (audio) {
      try { audio.pause(); } catch(e){}
    }
    var video = $('activeModernVideo');
    if (video) {
      try { video.pause(); } catch(e){}
    }
    if (window._activeFlvPlayer) {
      try { window._activeFlvPlayer.destroy(); } catch(e){}
      window._activeFlvPlayer = null;
    }
    if (window._activeRufflePlayer) {
      try { window._activeRufflePlayer.remove(); } catch(e){}
      window._activeRufflePlayer = null;
    }

    $('player').update('<div id="player"></div>');
    $('modal-content').hide();
    if ($('dock')) {
      var shield = $('dock').down('li.shield');
      if (shield) shield.hide();
    }
  },

  resetHidden: function() {
    if ($('hidden-player')) {
      $('hidden-player').replace('<div id="hidden-player"></div>');
    }
  },

  _getDefaultParams: function() {
    return this.DEFAULT_PARAMS.toObject();
  }
};
'''

with open(target_player_path, 'w', encoding='utf-8') as f:
    f.write(modern_player_js)

print("player.js completely modernized!")
