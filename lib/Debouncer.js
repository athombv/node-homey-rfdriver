
class Debouncer {
	constructor(time, idleFn, idleTime) {
		this.origTime = time;
		this.idle = false;
		this.idleFn = idleFn || (() => null);
		this.idleTime = isNaN(idleTime) ? 10000 : Number(idleTime);

		this._init();
	}

	_init() {
		this.time = this.origTime;
		this.state = Debouncer.INITED;
		this.start();
	}

	_setTimeout() {
		this.timeout = setTimeout(() => {
			if (Date.now() - this.startTime < this.time - 10) {
				this.state = Debouncer.REFRESH;
				this.time -= Date.now() - this.startTime;
				this.start();
			} else {
				this.state = Debouncer.FINISHED;
			}
		}, this.time >= 0 ? this.time : 0);
	}

	set state(state) {
		this._state = state;
		if (this._state === Debouncer.FINISHED) {
			if (!this.idle) {
				this.idle = true;
				this.idleTimeout = setTimeout(this.idleFn, this.idleTime);
			}
		} else if (this.idle) {
			clearTimeout(this.idleTimeout);
			this.idle = false;
		}
	}

	get state() {
		return this._state;
	}

	start() {
		if (this.state === Debouncer.INITED || this.state === Debouncer.PAUSED || this.state === Debouncer.REFRESH) {
			this.startTime = Date.now();
			this.state = Debouncer.STARTED;
			this._setTimeout();
		}
	}

	stop() {
		if (this.state === Debouncer.INITED || this.state === Debouncer.PAUSED) {
			clearTimeout(this.timeout);
			this.state = Debouncer.FINISHED;
		}
	}

	pause() {
		if (this.state === Debouncer.STARTED) {
			clearTimeout(this.timeout);
			this.state = Debouncer.PAUSED;
			this.time -= Date.now() - this.startTime;
		}
	}

	resume() {
		if (this.state === Debouncer.PAUSED) {
			this.start();
		}
	}

	reset() {
		if (this.state === Debouncer.FINISHED) {
			this._init();
			this.start();
		} else if (this.state === Debouncer.STARTED) {
			this.time = this.origTime;
			this.startTime = Date.now();
		} else if (this.state === Debouncer.PAUSED) {
			this.time = this.origTime;
			this.start();
		}
	}
}

Debouncer.INITED = -1;
Debouncer.STARTED = 0;
Debouncer.PAUSED = 1;
Debouncer.FINISHED = 2;
Debouncer.REFRESH = 3;

module.exports = Debouncer;