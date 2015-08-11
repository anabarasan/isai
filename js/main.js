function Isai () {
  this.currentTrackNo = 0;
  this.playlist = [];
  this.paused = false;
}

Isai.prototype.addSong = function addSong (fileEntry, callBack) {
    this.playlist.push(fileEntry);
    this.readID3Tags(this.playlist.length - 1, callBack);
};

Isai.prototype.getSong = function getSong (songIndex) {
  if (!songIndex) {
    songIndex = this.currentTrackNo;
  }
  return this.playlist[songIndex];
};

Isai.prototype.getNextSong = function getNextSong () {
  var currentTrackNo = this.currentTrackNo;
  this.currentTrackNo += 1;
  if (this.currentTrackNo === this.playlist.length) {
    this.currentTrackNo = 0;
  }
  return this.getSong(currentTrackNo);
};

Isai.prototype.updateTrackNumber = function updateTrackNumber(incrementValue) {
  isai.currentTrackNo += incrementValue;
  if ((isai.currentTrackNo == -1) || 
    (isai.currentTrackNo == isai.playlist.length)) {
      isai.currentTrackNo = 0;
  }
};

/**
 * readID3Tags
 * based on 
 *    http://www.html5rocks.com/en/tutorials/file/filesystem/
 *    http://ericbidelman.tumblr.com/post/8343485440/reading-mp3-id3-tags-in-javascript
 * tries to read ID3 Tag information, if not available sets the flag as false
 */
Isai.prototype.readID3Tags = function readID3Tags (seqNo, callBack) {
  var reader = new FileReader(),
    playlist = this.playlist,
    fileReader = playlist[seqNo];
    
  reader.onload = function readID3TagsInfo () {
    var dv = new jDataView(this.result);
    if (dv.getString(3, dv.byteLength - 128) == 'TAG') {
      id3 = {
        title : dv.getString(30, dv.tell()),
        artist : dv.getString(30, dv.tell()),
        album : dv.getString(30, dv.tell()),
        year : dv.getString(4, dv.tell())
      };
      fileReader.hasID3 = true;
      fileReader.ID3 = id3;
    } else {
      fileReader.hasID3 = false;
    }
    playlist[seqNo] = fileReader;
    if (callBack) {
      callBack();
    }
  };
  
  fileReader.file(function readSongSuccess (file) {
    reader.readAsArrayBuffer(file);
  }, function readSongFailure (error) {
    console.error('Error Trying to read ID3 Tag of ' + fileEntry.name);
  });
};

/**
 * addSongToPlaylist
 * adds the selected song to playlist array
 */
function addSongToPlaylist () {
  chrome.fileSystem.chooseEntry({
    'type': 'openFile',
    'accepts': [{'extensions': ['mp3']}]
  }, function entryToOpen(Entry){
    if (Entry) {
      isai.addSong(Entry, updatePlaylist);
      // updatePlaylist();
    } else {
      console.error('Error : Empty File Entry.  File not selected or Cancelled');
    }
  });
}

/**
 * play
 * plays the song in the current tracknumber position.
 * if paused, resumes the playback.
 */
function play () {
  if (!currentSong) {
    console.log('no currentSong. selecting the song on current tracknumber position');
    currentSong = isai.getSong();
  }
  
  updateDisplay();
  
  if (isai.paused) {
    player.trigger('play');
    isai.paused = false;
  } else {
    currentSong.file(function songSuccessCB (file) {
      var url = URL.createObjectURL(file);
      player.attr('src', url);
      playMedia();
    }, function songErrorCB (error) {
      console.error(error);
    });
  }
}

/**
 * pause
 * pauses the playback of the song
 */
function pause () {
  player.trigger('pause');
  isai.paused = true;
}

/**
 * stop
 * stops the playback of the song
 * does so by pausing the song and setting the currentTime property to zero
 */
function stop() {
  isai.paused = false;
  player.trigger('pause');
  player.prop('currentTime', 0);
}

/**
 * previous
 * decrements the currentTrackNo property by 1 and clears the currentSong and plays
 */
function previous () {
  isai.updateTrackNumber(-1);
  isai.paused = false;
  currentSong = undefined;
  play();
}

/**
 * next
 * increments the currentTrackNo property by 1 and clears the currentSong and plays
 */
function next () {
  isai.updateTrackNumber(1);
  isai.paused = false;
  currentSong = undefined;
  play();
}

/**
 * playMedia
 * checks if the media is ready to played, else waits for the media to be ready
 * done so to prevent playing of the same song, when next or prev is clicked.
 */
function playMedia() {
  if (player.prop('readyState') == 4) {
    player.trigger('play');
  } else {
    setTimeout(playMedia, 1000);
  }
}

/**
 * updateDisplay
 * updated the song name displayed in the player
 */
function updateDisplay () {
  if (currentSong.hasID3) {
    var id3 = currentSong.ID3,
      info = id3.album + ' - ' + id3.title;
      songInfo.text(info);
  } else {
    songInfo.text(currentSong.name);
  }
}

/**
 * updatePlaylist
 * updates the playlist with changes to the Isai.playlist
 */
function updatePlaylist () {
  playList.empty();
  isai.playlist.forEach(function(songEntry, index){
    var li = $('<li>');
    li.attr('data-pos', index);
    if (songEntry.hasID3) {
      li.html('<span class="cancel" data-pos="'+ index  +'">&nbsp;</span>' + 
        songEntry.ID3.album + ' - ' + songEntry.ID3.title);
    } else {
      li.html('<span class="cancel" data-pos="'+ index  +'">&nbsp;</span>' + 
        songEntry.name);
    }
    playList.append(li);
  });
}

/**
 * updateProgressBar
 * updates the progressbar of the player with the current position of the song
 */
function updateProgressBar () {
  progressBar.attr('value', player.prop('currentTime'));
}

/**
 * onSongEnd
 * when the song ends, resets the player source, clears the currentSong variable
 * and increments the currentTrackNumber by 1 to play the next song in the list
 */
function onSongEnd () {
  console.debug('song ended');
  player.attr('src', '');
  console.debug(player.get(0));
  currentSong = undefined;
  isai.updateTrackNumber(1);
  play();
}

/**
 * onSongChange
 * when the player changes song this method will be called.
 * it updates the progressbar max values based on the currently loaded songs duration
 */
function onSongChange () {
  console.info('song change');
  progressBar.attr('max', player.prop('duration'));
}

/**
 * playSelectedSong
 * plays the selected song in the playlist
 */
function playSelectedSong() {
  var $this = $(this);
  isai.currentTrackNo = $this.data('pos');
  isai.paused = false;
  currentSong = undefined;
  play();
}

/**
 * removeSelectedSong
 * remove the selected song from the playlist
 */
function removeSelectedSong() {
  var $this = $(this),
    selected = $this.data('pos');
    isai.playlist.splice(selected, 1);
    updatePlaylist();
}

var isai,
  currentSong,
  player,
  songInfo,
  playList,
  progressBar;

$(document).ready(function () {
  isai = new Isai();
  player = $('#player');
  songInfo = $('#info');
  playList = $('#playlist');
  progressBar = $('#progressbar');
  
  $('#btnOpen').on('click', addSongToPlaylist);
  $('#btnPlay').on('click', play);
  $('#btnPause').on('click', pause);
  $('#btnStop').on('click', stop);
  $('#btnPrev').on('click', previous);
  $('#btnNext').on('click', next);
  
  player.on('ended', onSongEnd);
  player.on('durationchange', onSongChange);
  player.on('timeupdate', updateProgressBar);
  player.on('loadedmetadata', updateDisplay);
  
  $('#playlist').on('dblclick', 'li', playSelectedSong);
  $('#playlist').on('click', '.cancel', removeSelectedSong);
});
