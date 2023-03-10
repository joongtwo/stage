// Copyright (c) 2022 Siemens

/**
 * @module js/aceExpandBelowFetchAllService
 */
import aceExpandBelowService from 'js/aceExpandBelowService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import AwIntervalService from 'js/awIntervalService';
import soaSvc from 'soa/kernel/soaService';

let _cxtUpdateListener = null;
let _autoBookmarkSavedEvent = null;
var _nodesCameForExpansion = [];

let completeExpandBelowFetchAll = function( contextKey ) {
    _autoBookmarkSavedEvent = eventBus.subscribe( 'StartSaveAutoBookmarkEvent', function( context ) {
        let aceActiveContext = appCtxService.ctx.aceActiveContext;
        let emptyVmos = [];
        if( aceActiveContext.context && aceActiveContext.context.vmc ) {
            let loadedVMObjects = aceActiveContext.context.vmc.loadedVMObjects;
            let endIndex = loadedVMObjects.length;
            for( var i = 0; i <= endIndex; i++ ) {
                var vmo = loadedVMObjects[ i ];
                if( vmo && !vmo.props ) {
                    emptyVmos.push( vmo );
                }
            }
        }
        if( emptyVmos.length > 200 && soaSvc.getPendingRequestsCount() < 20 ) {
            eventBus.publish( 'occTreeTable.plTable.loadProps', {
                VMOs: emptyVmos
            } );
        }
    }, 5000 );
};

let initializeTimerForFetchAll = function( contextKey ) {
    _cxtUpdateListener = eventBus.subscribe( 'occDataLoadedEvent', function( context ) {
        let currentContext = appCtxService.getCtx( contextKey );
        let emptyVmos = [];
        let loadedVMObjects = currentContext.vmc.getLoadedViewModelObjects();
        let endIndex = loadedVMObjects.length;
        let expandBelowFetchAllStartIndex = currentContext.expandBelowFetchAllStartIndex;

        if( !_.isUndefined( expandBelowFetchAllStartIndex  ) ) {
            //fire expandBelow for nodes in inExpandBelow mode true state...
            appCtxService.updatePartialCtx( contextKey + '.expandBelowFetchAllStartIndex', endIndex );
            var count = 0;
            var foundNodeInExpandBelowMode = false;
            for( var i = 0; i <= endIndex; i++ ) {
                var vmo = loadedVMObjects[ i ];
                if( vmo && vmo.isInExpandBelowMode && _.isEmpty( vmo.children ) && soaSvc.getPendingRequestsCount() < 10 ) {
                    foundNodeInExpandBelowMode = true;
                    count++;
                    if ( _.indexOf( _nodesCameForExpansion, vmo.id ) === -1 ) {
                        _nodesCameForExpansion.push( vmo.id );
                        eventBus.publish( currentContext.vmc.name + '.expandTreeNode', {
                            parentNode: {
                                id: vmo.id
                            }
                        } );
                    }else{
                        var duplicateReq = true;
                    }
                    if( count === 20 ) {
                       break;
                    }
                }
            }
        }

        if( currentContext.expandBelowFetchAllStartIndex !== 0 && foundNodeInExpandBelowMode === false  ) {
            //fire expandBelow for nodes in inExpandBelow mode true state...
            //appCtxService.updatePartialCtx( contextKey + '.isExpandBelowFetchAll', 'done' );
            for( i = 0; i <= endIndex; i++ ) {
                vmo = loadedVMObjects[ i ];
                if( vmo && !vmo.props ) {
                    emptyVmos.push( vmo );
                }
            }
            if( emptyVmos.length > 200 ) {
                eventBus.publish( 'occTreeTable.plTable.loadProps', {
                    VMOs: emptyVmos
                } );

                completeExpandBelowFetchAll( contextKey );
            }
            //eventBus.unsubscribe( _cxtUpdateListener );
        }
    } );
};

export let performExpandBelowFetchAll = function( expansionCriteria, commandContext, nodesToMarkCollapsed ) {
    let contextKey = appCtxService.ctx.aceActiveContext.key;

    _nodesCameForExpansion = [];

    appCtxService.updatePartialCtx( contextKey + '.expandBelowFetchAllStartIndex', 0 );
    initializeTimerForFetchAll( contextKey );
    aceExpandBelowService.performExpandBelow( expansionCriteria, commandContext, nodesToMarkCollapsed, true );
};


export let destroy = function() {
    // if( _awTableToggleRowEvetSubscription ) {
    //     eventBus.unsubscribe( _awTableToggleRowEvetSubscription );
    //     _awTableToggleRowEvetSubscription = null;
    // }
};
