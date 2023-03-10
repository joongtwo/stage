// Copyright (c) 2022 Siemens

/**
 * This is a service utility file for synchronizing parts of the classification tree.
 *
 * @module js/classifyTreeSyncUtils
 */
import _ from 'lodash';
import classifyService from 'js/classifyService';
import clsTreeSvc from 'js/Awp0ClassificationTreeService';

var exports = {};

/**
 *  Clears out the current selection.
 * @param {SelectionModel} selectionModel selection model of panel
 */
export let clearSelection = function( selectionModel ) {
    const tmpSelectionData = { ...selectionModel.selectionData.value };
    tmpSelectionData.selected = [];
    selectionModel.selectionData.update( tmpSelectionData );
};

/**
 *  Establishes the root set of classes.
 * @param {SelectionModel} navigateState the navigation state to record the originVNCs into.
 * @param {ViewModelObjects[]} selectionModel the collection to write into the navigateState.
 */
export let establishNavigationRoot = function( navigateState, selectionModel ) {
    //Launch VNCs
    const tmpContext = { ...navigateState.value };
    if( selectionModel.selectionData && selectionModel.selectionData.selectedClassNode && !tmpContext.originVNCs ) {
        tmpContext.originVNCs = selectionModel.selectionData.selectedClassNode.treeLoadResult;
        navigateState.update( tmpContext );
    }
};

/**
 *  Removes references to parent objects on deselection.
 * @param {SelectionModel} navigateState the navigation state to clear the selection from.
 */
export let deselectNavigation = function( navigateState ) {
    //Launch VNCs
    const tmpContext = { ...navigateState.value };
    tmpContext.parent = '';
    tmpContext.parentDisplayName = '';
    navigateState.update( tmpContext );
};

/**
 *  Clears out any kind of class information on an invalid search.
 * @param {SelectionModel} classifyState the classify state to tell there is no selection.
 * @param {SelectionModel} selectionModel the selection model driving the classification tree.
 */
export let setNoVnc = function( classifyState, selectionModel ) {
    if( classifyState ) {
        const tmpState = { ...classifyState.value };
        tmpState.selectedClassNode = null;
        classifyState.update( tmpState );
        if ( selectionModel && selectionModel.selectionData ) {
            const tmpSelectionData = { ...selectionModel.selectionData.value };
            tmpSelectionData.selectedClassNode = null;
            tmpSelectionData.previouslySelectedClassNode = null;
            selectionModel.selectionData.update( tmpSelectionData );
        }
    }
};

/**
 *  Clears out any kind of class information on an invalid search.
 * @param {SelectionModel} searchState the search state to tell there is no selection.
 * @param {SelectionModel} selectionModel the selection model driving the classification tree.
 */
export let noSelectionSearchState = function( searchState, selectionModel ) {
    if( searchState ) {
        const tmpState = { ...searchState.value };
        tmpState.showNoCriteriaMessage = true;
        searchState.update( tmpState );
        const tmpSelectionData = { ...selectionModel.selectionData.value };
        tmpSelectionData.selectedClassNode = null;
        tmpSelectionData.previouslySelectedClassNode = null;
        tmpSelectionData.selected = [];
        selectionModel.selectionData.update( tmpSelectionData );
    }
};

/**
 *
 * @param {object} vmCollection current collection of view model objects on tree.
 * @param {object} selectionModel selection model to indicate no selection is being made.
 * @param {object} classifyState the state to update with the cleared out information.
 * @param {Boolean} deselect whether to trigger the deselection on the selection model.
 * @param {Boolean} searchString search phrase to use to narrow VNC results.
 */
function resetTree( vmCollection, selectionModel, classifyState, deselect, searchString ) {
    var response = {};
    response.reset = true;
    response.userReset = true;
    response.treeLoadResult = {};
    response.treeLoadResult.parentNode = {};
    response.treeLoadResult.parentNode.children = vmCollection.loadedVMObjects;
    response.treeLoadResult.rootPathNodes = [];
    if( deselect ) {
        selectionModel.selectNone();
    }
    clsTreeSvc.updateSelectedClassNode( null, classifyState, response, searchString );
}

/**
 *
 * @param {object} selectionModel selection model to indicate no selection is being made.
 */
function destroySelection( selectionModel ) {
    let tmpContext = { ...selectionModel.selectionData.value };
    tmpContext.selected = [];
    if( selectionModel.selectionData.selected && selectionModel.selectionData.selected.length ) {
        selectionModel.selectionData.update( tmpContext );
    }
}

/**
 *
 * @param {object} response data given of class nodes.
 * @param {object} context current context of the tree.
 */
function resetSelectedToDefault( response, context ) {
    const tmpContext = { ...context.value };
    const selected = context.value.selected;
    const treeResult = response.treeLoadResult;
    if ( selected && selected.length && treeResult.parentNode && selected[0].uid === treeResult.parentNode.uid ||
        treeResult && treeResult.rootPathNodes && treeResult.rootPathNodes.length ||
        response.reset
    ) {
        //There is no support for deselecting a node from the table. Implementing here with 'reset' logic.
        if ( response.reset ) {
            //Need to pull in the classify state reset logic
            tmpContext.attrs = null;
            tmpContext.selectedClass = null;
            tmpContext.selectedNode = null;
            tmpContext.hasImages = null;
        }

        //Setup suggestions.
        if ( response.clsClassDescriptors ) {
            //setup suggested classes.
            var suggTreeLoadResult = [];
            //TODO: Clean up.
            _.forEach( response.clsClassDescriptors, function( suggestion ) {
                var suggestedCls = classifyService.parseIndividualClassDescriptor( suggestion, true );
                suggTreeLoadResult.push( suggestedCls );
            } );
            var suggestedClasses = [];
            _.forEach( suggTreeLoadResult, function( cls ) {
                if( cls.classProbability ) {
                    suggestedClasses.push( cls );
                }
            } );
            if( suggestedClasses && suggestedClasses.length ) {
                suggTreeLoadResult = clsTreeSvc.convertToVMNodes( suggestedClasses, { parentNode: 0 } );
                tmpContext.suggestedClasses = suggTreeLoadResult;
                delete response.clsClassDescriptors;
            }
        }
        if ( response.searchResults ) {
            //setup search result classes.
            var treeLoadResult = {};
            let nodesToDelete = Object.values( response.searchResults ).filter( ( result ) => { return result.parentid === 'SAM'; } );
            nodesToDelete.forEach( ( node ) => {
                delete response.searchResults[node.id];
            } );
            var childNodes = Object.values( response.searchResults );
            if( childNodes.length ) {
                childNodes = clsTreeSvc.convertToVMNodes( childNodes, { parentNode: 0 } );
                treeLoadResult.parentNode = {};
                treeLoadResult.parentNode.children = childNodes;
                treeLoadResult.rootPathNodes = {};
                tmpContext.selectedClassNode = { treeLoadResult: treeLoadResult };
            }
            delete response.searchResults;
        } else {
            if( response.treeLoadResult ) {
                tmpContext.selectedClassNode = response;
            }
        }

        context.update( tmpContext );
    }
}

export default exports = {
    clearSelection,
    deselectNavigation,
    destroySelection,
    establishNavigationRoot,
    resetTree,
    resetSelectedToDefault,
    setNoVnc,
    noSelectionSearchState
};
