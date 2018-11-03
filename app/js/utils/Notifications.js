import { default as Vue } from 'vue'
import { default as $ } from 'jquery'
import { defaultToastOptions } from '../constants'

export class Notifications {
	static show (message, options) {
		Vue.toasted.show(message, $.extend({}, defaultToastOptions, options))
	}
}
