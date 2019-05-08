import {
    AnyEventResponse,
    ClickEventRequest,
    ClickEventResponse,
    CustomEventRequest,
    CustomEventResponse,
    EventBaseRequest,
    HealthResponse,
    SearchEventRequest,
    SearchEventResponse,
    ViewEventRequest,
    ViewEventResponse,
    VisitResponse
    } from '../events';
import { HistoryStore } from '../history';

export const Version = 'v15';

export const Endpoints = {
    default: 'https://usageanalytics.coveo.com',
    production: 'https://usageanalytics.coveo.com',
    hipaa: 'https://usageanalyticshipaa.coveo.com'
};

export interface ClientOptions {
    token: string;
    endpoint?: string;
    version?: string;
}

export enum EventType {
    search = 'search',
    click = 'click',
    custom = 'custom',
    view = 'view'
}

export interface AnalyticsClient {
    sendEvent(eventType: string, payload: any): Promise<AnyEventResponse>;
    sendSearchEvent(request: SearchEventRequest): Promise<SearchEventResponse>;
    sendClickEvent(request: ClickEventRequest): Promise<ClickEventResponse>;
    sendCustomEvent(request: CustomEventRequest): Promise<CustomEventResponse>;
    sendViewEvent(request: ViewEventRequest): Promise<ViewEventResponse>;
    getVisit(): Promise<VisitResponse>;
    getHealth(): Promise<HealthResponse>;
}

export class CoveoAnalyticsClient implements AnalyticsClient {
    private endpoint: string;
    private token: string;
    private version: string;

    constructor(opts: ClientOptions) {
        if (typeof opts === 'undefined') {
            throw new Error('You have to pass options to this constructor');
        }

        this.endpoint = opts.endpoint || Endpoints.default;
        this.token = opts.token;
        this.version = opts.version || Version;
    }

    async sendEvent(eventType: EventType, payload: any): Promise<AnyEventResponse> {
        if (eventType === 'view') {
            this.addPageViewToHistory(payload.contentIdValue);
        }

        const augmentedPayload = this.augmentPayloadForTypeOfEvent(eventType, payload);
        const cleanedPayload = this.removeEmptyPayloadValues(augmentedPayload);

        const response = await fetch(`${this.getRestEndpoint()}/analytics/${eventType}`, {
            method: 'POST',
            headers: this.getHeaders(),
            mode: 'cors',
            body: JSON.stringify(cleanedPayload),
            credentials: 'include'
        });
        if (response.ok) {
            return await response.json() as AnyEventResponse;
        } else {
            console.error(`An error has occured when sending the "${eventType}" event.`, response, payload);
            throw new Error(`An error has occurred when sending the "${eventType}" event. Check the console logs for more details.`);
        }
    }

    async sendSearchEvent(request: SearchEventRequest): Promise<SearchEventResponse> {
        return this.sendEvent(EventType.search, request);
    }

    async sendClickEvent(request: ClickEventRequest): Promise<ClickEventResponse> {
        return this.sendEvent(EventType.click, request);
    }

    async sendCustomEvent(request: CustomEventRequest): Promise<CustomEventResponse> {
        return this.sendEvent(EventType.custom, request);
    }

    async sendViewEvent(request: ViewEventRequest): Promise<ViewEventResponse> {
        return this.sendEvent(EventType.view, request);
    }

    async getVisit(): Promise<VisitResponse> {
        const response = await fetch(`${this.getRestEndpoint()}/analytics/visit`);
        return await response.json();
    }

    async getHealth(): Promise<HealthResponse> {
        const response = await fetch(`${this.getRestEndpoint()}/analytics/monitoring/health`);
        return await response.json();
    }

    private augmentPayloadForTypeOfEvent(eventType: EventType, payload: any) {
        const baseDefaultValues: EventBaseRequest = {
            language: document.documentElement.lang,
            userAgent: navigator.userAgent
        };
        if (eventType === 'view') {
            return {
                location: window.location.toString(),
                referrer: document.referrer,
                title: document.title,
                ...baseDefaultValues,
                ...payload
            } as ViewEventRequest;
        } else {
            return {
                ...baseDefaultValues,
                ...payload
            };
        }
    }

    private removeEmptyPayloadValues(payload: any) {
        return Object.keys(payload)
            .filter(key => !!payload[key])
            .reduce((newPayload, key) => ({
                ...newPayload,
                [key]: payload[key]
            }), {});
    }

    private addPageViewToHistory(pageViewValue: string) {
        const store = new HistoryStore();
        const historyElement = {
            name: 'PageView',
            value: pageViewValue,
            time: JSON.stringify(new Date()),
        };
        store.addElement(historyElement);
    }

    protected getRestEndpoint(): string {
        return `${this.endpoint}/rest/${this.version}`;
    }

    protected getHeaders(): any {
        var headers: any = {
            'Content-Type': `application/json`
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
}

/** @deprecated Use CoveoAnalyticsClient instead. */
export const Client = CoveoAnalyticsClient;

export default CoveoAnalyticsClient;