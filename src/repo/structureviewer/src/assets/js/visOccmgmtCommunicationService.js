// Copyright (c) 2022 Siemens
/* eslint-disable no-invalid-this */
/* eslint-disable class-methods-use-this */

/**
 * This class is a mediator between AW and various viewer
 *
 * @module js/visOccmgmtCommunicationService
 */
import AwBaseService from 'js/awBaseService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';

export default class VisOccmgmtCommunicationService extends AwBaseService {
    /**
     * Constructor of VisOccmgmtCommunicationService
     */
    constructor() {
        super();
        this.observers = [];
        this.eventsToListen = [
            'ace.elementsRemoved',
            'replaceElement.elementReplacedSuccessfully',
            'primaryWorkArea.contentsReloaded',
            'occurrenceUpdatedByEffectivityEvent',
            'primaryWorkArea.selectionChangeEvent',
            'perform.packAllSimilarElements',
            'postProcessPackUnpackAction',
            'cba.alignmentUpdated',
            'cdm.updated',
            'cdm.relatedModified',
            'addElement.elementsAdded',
            'productContextChangedEvent'
        ];
        this.eventSubscriptions = {};
        this.subscribeToEvents();
        this.activeVisibilityObserver = null;
        this.aceVisibilitySubscription = [];
        this.cachedPWAContentsReloadedEventData = null;
    }

    /**
     * Subscribes to visOccmgmtCommunicationService
     * @param {Object} observer who wants to subscribe
     */
    subscribe( observer ) {
        if( !_.includes( this.observers, observer ) ) {
            this.observers.push( observer );
        }
    }

    /**
     * Unsubscribes to visOccmgmtCommunicationService
     * @param {Object} observer who wants to unsubscribe
     */
    unsubscribe( observer ) {
        this.observers = this.observers.filter(
            function( existingObs ) {
                if( existingObs !== observer ) {
                    return existingObs;
                }
            }
        );
        if( this.observers.length === 0 ) {
            this.activeVisibilityObserver = null;
        }
    }

    /**
     * Subscribes to list of events
     */
    subscribeToEvents() {
        let self = this;
        for( let i = 0; i < self.eventsToListen.length; i++ ) {
            let eventSub = eventBus.subscribe( self.eventsToListen[ i ], self.getEventHandler( self.eventsToListen[ i ] ), 'VisOccmgmtCommunicationService' );
            self.eventSubscriptions[ self.eventsToListen[ i ] ] = eventSub;
        }
    }

    /**
     * Gets event handler to be subscribe for event passed
     * @param {String} event type of event
     * @returns {Function} call back function
     */
    getEventHandler( event ) {
        if( event === 'ace.elementsRemoved' ) {
            return this.reloadEventsHandler;
        } else if( event === 'replaceElement.elementReplacedSuccessfully' ) {
            return this.reloadEventsHandler;
        } else if( event === 'primaryWorkArea.contentsReloaded' ) {
            return this.primaryWorkAreaContentsReloadedEventHandler;
        } else if( event === 'occurrenceUpdatedByEffectivityEvent' ) {
            return this.occurrenceUpdatedByEffectivityEventHandler;
        } else if( event === 'primaryWorkArea.selectionChangeEvent' ) {
            return this.selectionChangedEventHandler;
        } else if( event === 'perform.packAllSimilarElements' ) {
            return this.packUnpackEventHandler;
        } else if( event === 'postProcessPackUnpackAction' ) {
            return this.packUnpackEventHandler;
        } else if( event === 'cba.alignmentUpdated' ) {
            return this.reloadEventsHandler;
        } else if( event === 'cdm.updated' ) {
            return this.cdmUpdatedEventHandler;
        } else if( event === 'cdm.relatedModified' ) {
            return this.cdmRelatedModifiedEventHandler;
        } else if( event === 'addElement.elementsAdded' ) {
            return this.reloadEventsHandler;
        } else if( event === 'productContextChangedEvent' ) {
            return this.productContextChangedEventHandler;
        }
    }

    /**
     * Handle Product Context Changed event
     * @param {Object} eventData event data
     */
    productContextChangedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleProductContextChangedEvent', eventData );
    }

    /**
     * Event handler for following events:
     * ace.elementsRemoved
     * replaceElement.elementReplacedSuccessfully
     * cba.alignmentUpdated
     * addElement.elementsAdded
     * @param {object} eventData event data
     */
    reloadEventsHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleReloadEvents', eventData );
    }

    /**
     *  handleCdmUpdatedEvent event handler
     * @param {object} eventData event data
     */
    cdmUpdatedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleCdmUpdatedEvent', eventData );
    }

    /**
     *  handleCdmRelatedModifiedEvent event handler
     * @param {object} eventData event data
     */
    cdmRelatedModifiedEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleCdmRelatedModifiedEvent', eventData );
    }

    /**
     *  handleUseIndexedModelSettingsChangedEvent event handler
     * @param {object} eventData event data
     */
    useIndexedModelSettingsChangedEventHandler() {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleUseIndexedModelSettingsChangedEvent' );
    }

    /**
     * handlePrimaryWorkAreaContentsReloadedEvent event handler
     * @param {Object} eventData event data
     */
    primaryWorkAreaContentsReloadedEventHandler( eventData ) {
        let occContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
        if( occContext !== null && occContext.currentState.spageId !== null && occContext.currentState.spageId !== "Awv0StructureViewerPageContainer"){
            VisOccmgmtCommunicationService.instance.cachedPWAContentsReloadedEventData = eventData;
        }
        
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handlePrimaryWorkAreaContentsReloadedEvent', eventData );
    }

    /**
     * Data will be cached if a change happens while not on the 3D tab
     */
    getCachedPWAContentsReloadedEventData(){
        let retEventData = this.cachedPWAContentsReloadedEventData;
        this.cachedPWAContentsReloadedEventData = null;
        return retEventData;
    }

    /**
     * handleOccurrenceUpdatedByEffectivityEvent event handler
     * @param {Object} eventData event data
     */
    occurrenceUpdatedByEffectivityEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleOccurrenceUpdatedByEffectivityEvent', eventData );
    }

    /**
     * handleSelectionChangedEvent event handler
     * @param {Object} eventData event data
     */
    selectionChangedEventHandler( eventData ) {
        if( eventData && eventData.selectionModel ) {
            VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleSelectionChangedEvent', eventData );
        }
    }

    /**
     * Pack unpack event handler
     * @param {Object} eventData event data
     */
    packUnpackEventHandler( eventData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handlePackUnpackEvent', eventData );
    }

    /**
     * Gets occurence visibility for ACE tree from active visibility observer
     * @param {Object} vmo view model object
     * @returns {Boolean} true/false
     */
    getOccVisibilityHandler( vmo ) {
        let activeVisibilityObserver = VisOccmgmtCommunicationService.instance.activeVisibilityObserver;
        if( activeVisibilityObserver ) {
            return activeVisibilityObserver.handleGetOccVisibilty.call( activeVisibilityObserver, vmo );
        }
    }

    /**
     * Toggles visibility of observers when visibility changed from ACE tree
     * @param {Object} vmo view model object
     * @param {String} occmgmtActiveCtxKey occmgmt context for which visibility is toggled
     */
    toggleOccVisibilityHandler( vmo, occmgmtActiveCtxKey ) {
        let eventData = {
            vmo: vmo,
            contextKey: occmgmtActiveCtxKey
        };
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleToggleOccVisibility', eventData );
    }

    /**
     * Notifies visibility changes to observer
     * @param {Object} visibilityData visibility dat contains invisibleCsids, invisibleExceptionCsids, invisiblePartitionIds, isStateChange
     */
    notifyVisibilityChangesToObservers( visibilityData ) {
        VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'handleVisibilityChanges', visibilityData );
    }

    /**
     * Propagates Event changes to registered observers
     * @param {String} functionName name of function to be called from observer
     * @param {Object} eventData event data, passed to obeserver
     */
    propagateEventsToObservers( functionName, eventData ) {
        _.forEach( this.observers, observer => {
            if( typeof observer[ functionName ] === 'function' ) {
                observer[ functionName ].call( observer, eventData );
            }
        } );
    }

    /**
     * Notifies selection changes to ACE tree
     * @param {Array} modelObjectsToSelect model objects to select
     * @param {String} viewToReact occmgmt context key passed to notify ACE to identity view to react
     */
    notifySelectionChangesToAce( modelObjectsToSelect, modelObjectsToHighlight, viewToReact ) {
        let aceSelectionUpdateEventData = {};
        aceSelectionUpdateEventData.objectsToSelect = modelObjectsToSelect;
        aceSelectionUpdateEventData.objectsToHighlight = modelObjectsToHighlight;
        aceSelectionUpdateEventData.viewToReact = viewToReact;
        eventBus.publish( 'aceElementsSelectionUpdatedEvent', aceSelectionUpdateEventData );
    }

    /**
     * Notifies visibility changes to ACE tree from registered viewer
     * @param {String} viewToReact occmgmt context key passed to notify ACE to identity view to react
     * @param {String} viewerType to set active visibility obseerver to whom ACE tree will ask for visibility state
     */
    notifyVisibilityChangesToAce( viewToReact, viewerType ) {
        let self = this;
        _.forEach( this.observers, observer => {
            if( observer.getViewerType() === viewerType ) {
                self.activeVisibilityObserver = observer;
            }
        } );
        let aceVisibilityUpdateEventData = {};
        aceVisibilityUpdateEventData.viewToReact = viewToReact;
        //We need to fire this event to ensure the cell thumbnail titles are activated.
        eventBus.publish( 'occMgmt.visibilityStateChanged', aceVisibilityUpdateEventData );
    }

    /**
     * Registers functions to ACE tree visibility change if not registered for occmgmt context
     * @param {String} occmgmtContextNameKey occmgmt context key
     * @param {String} viewerType type of viewer registering
     */
    registerVisibilityEventsToAce( occmgmtContextNameKey, viewerType ) {
        let occmgmtContext = appCtxService.getCtx( occmgmtContextNameKey );
        occmgmtContext.cellVisibility = {};
        occmgmtContext.cellVisibility.getOccVisibility = this.getOccVisibilityHandler;
        occmgmtContext.cellVisibility.toggleOccVisibility = ( vmo ) => {
            this.toggleOccVisibilityHandler( vmo, occmgmtContextNameKey );
        };
        this.notifyVisibilityChangesToAce( occmgmtContextNameKey, viewerType );
        if( !this.aceVisibilitySubscription.includes( occmgmtContextNameKey ) ) {
            this.aceVisibilitySubscription.push( occmgmtContextNameKey );
            this.deregisterAfterLocationChange();
        }
    }

    deregisterAfterLocationChange() {
        let listenForsublocationChangeToDeregister = eventBus.subscribe( 'appCtx.update', function() {
            let locationContext = appCtxService.getCtx( 'locationContext' );
            if( locationContext && locationContext[ 'ActiveWorkspace:Location' ] !== 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.cba.CADBOMAlignment:CBASublocation' && locationContext[ 'ActiveWorkspace:Location' ] !== 'easyplan' &&
                locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'multiBOMManager:taskPageSubLocation' ) {
                eventBus.unsubscribe( listenForsublocationChangeToDeregister );
                this.aceVisibilitySubscription.forEach( function( occmgmtContextNameKey ) {
                    appCtxService.updatePartialCtx( occmgmtContextNameKey + '.cellVisibility', {} );
                    this.notifyVisibilityChangesToAce( occmgmtContextNameKey );
                }.bind( this ) );
                this.aceVisibilitySubscription.length = 0;
                VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'cleanUpViewerHandler', null );
                this.registerAfterLocationChange();
            }
        }.bind( this ) );
    }

    registerAfterLocationChange() {
        let listenForsublocationChangeToRegister = eventBus.subscribe( 'appCtx.update', function() {
            let locationContext = appCtxService.getCtx( 'locationContext' );
            if( locationContext && locationContext[ 'ActiveWorkspace:Location' ] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' && locationContext[
                'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' || locationContext[ 'ActiveWorkspace:Location' ] === 'easyplan' &&
                locationContext[ 'ActiveWorkspace:SubLocation' ] === 'multiBOMManager:taskPageSubLocation' ) {
                eventBus.unsubscribe( listenForsublocationChangeToRegister );
                VisOccmgmtCommunicationService.instance.propagateEventsToObservers( 'initializeHostVisViewerDataHandler', null );
            }
        } );
    }

    /**
     * Deregisters visibility events to ACE and disable visibility thumbnails from ACE tree
     */
    deregisterVisibilityEventsToAce( occmgmtContextNameKey ) {
        if( appCtxService.getCtx( occmgmtContextNameKey ) && ( this.observers.length === 0 || appCtxService.getCtx( 'splitView.mode' ) ) ) {
            appCtxService.updatePartialCtx( occmgmtContextNameKey + '.cellVisibility', {} );
            this.notifyVisibilityChangesToAce( occmgmtContextNameKey );
            this.aceVisibilitySubscription = this.aceVisibilitySubscription.filter( key => key !== occmgmtContextNameKey );
        }
    }

    /**
     * Gets visibility from first registered observer to pass on to other observer to be in sync
     * @returns {Object} visibility state contains invisibleCsids, invisibleExceptionCsids, invisiblePartitionIds
     */
    getVisibilityStateFromExistingObserver() {
        if( this.observers.length > 1 ) {
            return this.observers[ 0 ].getVisibilityState(); //return visibility of first registered observer
        }
        return null;
    }
}
