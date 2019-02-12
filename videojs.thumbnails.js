import videojs from 'video.js';

const defaults = {
	0: {
		src: 'example-thumbnail.png',
	},
};

const extend = () => {
	let args;
	let target;
	let i;
	let object;
	let property;

	args = Array.prototype.slice.call(arguments);
	target = args.shift() || {};
	for (i in args) {
		object = args[i];

		for (property in object) {
			if (object.hasOwnProperty(property)) {
				target[property] = typeof object[property] === 'object' ? extend(target[property], object[property]) : object[property];
			}
		}
	}
};

const getComputedStyle = (el, pseudo) => {
	return ((prop) => {
		return window.getComputedStyle ? window.getComputedStyle(el, pseudo)[prop] : el.currentStyle[prop];
	})();
};

const offsetParent = function(el) {
	return el.nodeName !== 'HTML' && getComputedStyle(el)('position') === 'static' ? offsetParent(el.offsetParent) : el;
};

const getVisibleWidth = (el, width) => {
	let calculatedWidth = 0;
	let clip;

	if (width) {
		calculatedWidth = parseFloat(width);
	} else {
		clip = getComputedStyle(el)('clip');
		if (clip !== 'auto' && clip !== 'inherit') {
			clip = clip.split(/(?:\(|\))/)[1].split(/(?:,| )/);

			if (clip.length === 4) {
				calculatedWidth = parseFloat(clip[1]) - parseFloat(clip[3]);
			}
		}
	}

	return calculatedWidth;
};

const getScrollOffset = () => {
	return window.pageXOffset ? { x: window.pageXOffset, y: window.pageYOffset } : { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };
};

const thumbnailPlugin = () => {
	let settings = extend({}, defaults, options);
	let progressControl;
	let duration;
	let moveCancel;
	let player = this;

	// Android doesn't support :active and :hover on non-anchor and non-button elements, so we need to fake the :active selector for thumbnails to show up
	if (navigator.userAgent.toLowerCase().indexOf('android') !== -1) {
		progressControl = player.controlBar.progressControl;

		const FAKE_ACTIVE_CLASS = 'fake-active';
		const addFakeActive = () => {
			progressControl.addClass(FAKE_ACTIVE_CLASS);
		};
		const removeFakeActive = () => {
			progressControl.removeClass(FAKE_ACTIVE_CLASS);
		};

		progressControl.on('touchstart', addFakeActive);
		progressControl.on('touchend', removeFakeActive);
		progressControl.on('touchcancel', removeFakeActive);
	}

	// create the thumbnail
	let div = document.createElement('div');
	div.className = 'vjs-thumbnail-holder';

	let img = document.createElement('img');
	div.appendChild(img);

	img.src = settings['0'].src;
	img.className = 'vjs-thumbnail';

	extend(img.style, settings['0'].style);

	// center the thumbnail over the cursor if an offset wasn't provided
	if (!img.style.left && !img.style.right) {
		img.onload = () => {
			img.style.left = `${-(img.naturalWidth / 2)}px`;
		};
	}

	// keep track of the duration to calculate correct thumbnail to display
	duration = player.duration();

	// when the container is MP4
	player.on('durationchange', (event) => {
		duration = player.duration();
	});

	// when the container is HLS
	player.on('loadedmetadata', (event) => {
		duration = player.duration();
	});

	// add the thumbnail to the player
	progressControl = player.controlBar.progressControl;
	progressControl.el().appendChild(div);

	const moveListener = (event) => {
		let mouseTime;
		let time;
		let active = 0;
		let left;
		let setting;
		let pageX;
		let right;
		let width;
		let halfWidth;
		let pageXOffset = getScrollOffset().x;
		let clientRect;

		clientRect = offsetParent(progressControl.el()).getBoundingClientRect();
		right = (clientRect.width || clientRect.right) + pageXOffset;

		pageX = event.pageX;
		if (event.changedTouches) {
			pageX = event.changedTouches[0].pageX;
		}

		// find the page offset of the mouse
		left = pageX || event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;

		// subtract the page offset of the positioned offset parent
		left -= offsetParent(progressControl.el()).getBoundingClientRect().left + pageXOffset;

		/**
		 * apply updated styles to the thumbnail if necessary
		 * mouseTime is the position of the mouse along the progress control bar
		 * 'left' applies to the mouse position relative to the player so we need to remove the progress control's left offset to know the mouse position relative to the progress control
		 */
		mouseTime = Math.floor(((left - progressControl.el().offsetLeft) / progressControl.width()) * duration);

		for (time in settings) {
			if (mouseTime > time) {
				active = Math.max(active, time);
			}
		}

		setting = settings[active];
		if (setting.src && img.src != setting.src) {
			img.src = setting.src;
		}
		if (setting.style && img.style != setting.style) {
			extend(img.style, setting.style);
		}

		width = getVisibleWidth(img, setting.width || settings[0].width);
		halfWidth = width / 2;

		// make sure that the thumbnail doesn't fall off the right side of the left side of the player
		if (left + halfWidth > right) {
			left -= left + halfWidth - right;
		} else if (left < halfWidth) {
			left = halfWidth;
		}

		div.style.left = `${left}px`;
	};

	// update the thumbnail while hovering
	progressControl.on('mousemove', moveListener);
	progressControl.on('touchmove', moveListener);

	moveCancel = (event) => {
		div.style.left = '-1000px';
	};

	// move the placeholder out of the way when not hovering
	progressControl.on('mouseout', moveCancel);
	progressControl.on('touchcancel', moveCancel);
	progressControl.on('touchend', moveCancel);
	player.on('userinactive', moveCancel);
};

(() => {
	videojs.registerPlugin('thumbnails', thumbnailPlugin);
})();
