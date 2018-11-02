import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
	state:     {
		loading:            {
			shown:    false,
			headline: '',
			elements: {}
		},
		googleMapsGeocoder: null
	},
	mutations: {
		showLoading(state, headline) {
			state.loading.headline = headline;
			state.loading.shown = true;
			state.loading.elements = {};
		},
		addLoadingElement(state, payload) {
			state.loading.elements[payload.id] = {
				text:   payload.text,
				status: payload.status || 'active'
			};
		},
		setLoadingElementStatus(state, payload) {
			if (state.loading.elements[payload.id]) {
				state.loading.elements[payload.id].status = payload.status;
			}
		},
		hideLoading(state) {
			state.loading.shown = false;
		},
		setGoogleMapsGeocoder(state, geocoder) {
			state.googleMapsGeocoder = geocoder;
		}
	},
	getters:   {
		loading:            state => {
			return state.loading;
		},
		googleMapsGeocoder: state => {
			return state.googleMapsGeocoder;
		}
	}
});