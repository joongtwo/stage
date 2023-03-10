//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * @module js/acePartialSelectionService
 */

import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import tableSvc from 'js/published/splmTablePublishedService';

'use strict';

let exports = {};

let evaluateIsUnpackCommandVisibility = function() {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    acePartialSelection.isPackedHiddenNodeSelected = false;
    for( const [ key, value ] of acePartialSelection.partialSelectionInfo.entries() ) {
        let visibleObject = cdm.getObject( value );
        if( !_.isUndefined( visibleObject ) &&
            !_.isUndefined( visibleObject.props.awb0IsPacked ) &&
            visibleObject.props.awb0IsPacked.dbValues.length > 0 &&
            visibleObject.props.awb0IsPacked.dbValues[ 0 ] === '1' ) {
            acePartialSelection.isPackedHiddenNodeSelected = true;
            break;
        }
    }
};

export let removeHiddenNodesFromSelection = function( occContext ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if(   _.isUndefined( context ) || _.isUndefined( context.vmc ) || _.isUndefined( occContext ) || _.isUndefined( occContext.pwaSelection ) ) {
        return;
    }
    let size = occContext.pwaSelection.length;
    let t_pwaSelection = occContext.pwaSelection;
    _.forEach( t_pwaSelection, function( selected ) {
        // check if vm node exists for selection, else its hidden selection
        let isHiddenNode = context.vmc.findViewModelObjectById( selected.uid ) === -1;
        if( isHiddenNode === true ) {
            // need to remove hidden node from mselected.
            for( var ndx = 0; ndx < size; ndx++ ) {
                if( selected.uid === occContext.pwaSelection[ndx].uid ) {
                    occContext.pwaSelection.splice( ndx, 1 );
                }
            }
        }
    } );
};

export let restorePartialSelection = function() {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );

    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( context.vmc ) || _.isUndefined( appCtxSvc.ctx.mselected ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    _.forEach( appCtxSvc.ctx.mselected, function( selected ) {
        // check if vm node exists for selection, else its hidden selection
        let isHiddenNode = context.vmc.findViewModelObjectById( selected.uid ) === -1;

        if( isHiddenNode === true ) {
            // we have hidden node, we need to find corresponding visible node
            _.forEach( acePartialSelection.partialSelectionInfoCache, function( partialSelectionInfoCacheSet ) {
                if( partialSelectionInfoCacheSet.has( selected.uid ) === true ) {
                    _.forEach( Array.from( partialSelectionInfoCacheSet ), function( elementUid ) {
                        let isVisibleNode = context.vmc.findViewModelObjectById( elementUid ) !== -1;
                        if( isVisibleNode === true ) {
                            acePartialSelection.partialSelectionInfo.set( selected.uid, elementUid );
                            acePartialSelection.partialSelectionInfo.set( elementUid, elementUid );
                            return false; // break;
                        }
                    } );
                }
            } );
        }
    } );
};

export let setPartialSelection = function( objectsToSelect, objectsToHighlight ) {
    if( _.isUndefined( objectsToSelect ) || _.isUndefined( objectsToHighlight ) ) {
        return;
    }

    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context.acePartialSelection ) ) {
        context.acePartialSelection = {
            partialSelectionInfo: new Map(),
            partialSelectionInfoCache: [],
            isPackedHiddenNodeSelected: false
        };
    }
    let acePartialSelection = context.acePartialSelection;
    let partialSelectionChanged = false;
    let foundPartialSelection = false;

    for( let inx = 0; inx < objectsToSelect.length; inx++ ) {
        if( !_.isUndefined( objectsToHighlight[ inx ] ) ) {
            let objectToHighligh = cdm.getObject( objectsToHighlight[ inx ].uid );
            if( !_.isUndefined( objectToHighligh ) && objectToHighligh !== null ) {
                foundPartialSelection = true;
                partialSelectionChanged = true;
                acePartialSelection.partialSelectionInfo.set( objectsToSelect[ inx ].uid, objectsToHighlight[ inx ].uid );

                // update partialSelectionInfoCache
                let partialSelectionSetExist = false;
                _.forEach( acePartialSelection.partialSelectionInfoCache, function( partialSelectionInfoCacheSet ) {
                    if( partialSelectionInfoCacheSet.has( objectsToSelect[ inx ].uid ) ||
                        partialSelectionInfoCacheSet.has( objectsToHighlight[ inx ].uid ) ) {
                        partialSelectionSetExist = true;
                        partialSelectionInfoCacheSet.add( objectsToSelect[ inx ].uid );
                        partialSelectionInfoCacheSet.add( objectsToHighlight[ inx ].uid );
                        return false; // break
                    }
                } );
                if( partialSelectionSetExist === false ) {
                    let partialSelectionInfoCacheSet = new Set();
                    partialSelectionInfoCacheSet.add( objectsToSelect[ inx ].uid );
                    partialSelectionInfoCacheSet.add( objectsToHighlight[ inx ].uid );
                    acePartialSelection.partialSelectionInfoCache.push( partialSelectionInfoCacheSet );
                }
            }
        }
    }

    if( objectsToHighlight.length <= 0 || foundPartialSelection === false ) {
        // Deselection requested
        acePartialSelection.partialSelectionInfo.clear();
        partialSelectionChanged = true;
    }

    if( partialSelectionChanged === true ) {
        eventBus.publish( 'reRenderTableOnClient' );
        evaluateIsUnpackCommandVisibility();
    }
};

export let removePartialSelection = function( newSelections, oldSelections ) {
    if( _.isUndefined( newSelections ) || _.isUndefined( oldSelections ) || !_.isArray( oldSelections ) ) {
        return;
    }

    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) ) {
        return;
    }
    let acePartialSelection = context.acePartialSelection;
    let removedSelections = _.filter( oldSelections, function( oldSeletion ) {
        return !_.includes( newSelections, oldSeletion );
    } );
    let partialSelectionChanged = false;
    for( let inx = 0; inx < removedSelections.length; ++inx ) {
        if( isPartiallySelected( removedSelections[ inx ].uid ) ) {
            partialSelectionChanged = true;
            acePartialSelection.partialSelectionInfo.delete( removedSelections[ inx ].uid );
        }
    }
    if( partialSelectionChanged === true || newSelections.length === 0 ) {
        eventBus.publish( 'reRenderTableOnClient' );
        evaluateIsUnpackCommandVisibility();
    }
};

export let isPartiallySelected = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }
    return context.acePartialSelection.partialSelectionInfo.has( elementUid );
};

export let isPartiallySelectedInTree = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey ); //$NON-NLS-1$
    var isNodeVisibleInTree = context.vmc.findViewModelObjectById( elementUid ) !== -1;
    if( !isNodeVisibleInTree ) {
        //If the node is not visible it may be hidden under packed visible node
        var visibleUid = context.acePartialSelection.partialSelectionInfo.get( elementUid );
        var isVisible = context.vmc.findViewModelObjectById( visibleUid ) !== -1;
    }
    if( isNodeVisibleInTree || isVisible ) {
        return true;
    }
    context.acePartialSelection.hiddenNode = null;
    context.acePartialSelection.hiddenNode = elementUid;
    context.transientRequestPref.focusSelectionFromViz = true;

    return false;
};

export let doesContainHiddenPackedSelection = function() {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( context.acePartialSelection.hiddenNode ) ) {
        return false;
    }
    return context.acePartialSelection.hiddenNode !== null;
};

export let doesContainPartialSelections = function( elements ) {
    let isPartialSelection = false;
    _.forEach( elements, function( element ) {
        if( !_.isUndefined( element ) && isPartiallySelected( element.uid ) ) {
            isPartialSelection = true;
            return false; // break
        }
    } );
    return isPartialSelection;
};

export let isHiddenNodePresentInPartialSelection = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }
    if( context.acePartialSelection.partialSelectionInfo.has( elementUid ) ) {
        let visibleUid = context.acePartialSelection.partialSelectionInfo.get( elementUid );
        return visibleUid !== elementUid; // hidden node will have different visible node.
    }
    return false;
};

export let isVisibleNodePresentInPartialSelection = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return false;
    }

    for( const [ key, value ] of context.acePartialSelection.partialSelectionInfo.entries() ) {
        if( !_.isUndefined( value ) && value === elementUid ) {
            return true;
        }
    }
    return false;
};

export let getVisibleNodeForHiddenNodeInPartialSelection = function( elementUid ) {
    let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
    let context = appCtxSvc.getCtx( contextKey );
    if( _.isUndefined( context ) || _.isUndefined( context.acePartialSelection ) || _.isUndefined( elementUid ) ) {
        return;
    }

    if( context.acePartialSelection.partialSelectionInfo.has( elementUid ) ) {
        return context.acePartialSelection.partialSelectionInfo.get( elementUid );
    }
};

let partialSelectionRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        if( rowElem ) {
            rowElem.classList.add( 'aw-occmgmtjs-partialSelection' );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        return isVisibleNodePresentInPartialSelection( vmo.uid ) === true;
    },
    name: 'partialSelectionRenderer'
};

export default exports = {
    setPartialSelection,
    removePartialSelection,
    removeHiddenNodesFromSelection,
    restorePartialSelection,
    isPartiallySelected,
    isPartiallySelectedInTree,
    doesContainHiddenPackedSelection,
    doesContainPartialSelections,
    isHiddenNodePresentInPartialSelection,
    isVisibleNodePresentInPartialSelection,
    getVisibleNodeForHiddenNodeInPartialSelection,
    partialSelectionRenderer
};
