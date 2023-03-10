// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Saw1ScheduleNavigationTreeService
 */
import _ from 'lodash';

// Source component from which the selection has happened.
let _selectionSource;

export const handleTreeSelectionChange = ( treeSelectionData, parentSelectionData, atomicDataRef ) => {
     if( _selectionSource === 'gantt') {
        _selectionSource ='';
        return;
    }
    _selectionSource = 'tree';
    if( treeSelectionData && treeSelectionData.selected ) {
        atomicDataRef.ganttSelectionData.setAtomicData( { id: 'ganttSelectionModel', selected: treeSelectionData.selected, source: 'tree' } );
    }
    updateParentSelection( parentSelectionData, treeSelectionData.selected );
};

export const handleGanttSelectionChange = ( ganttSelectionData, parentSelectionData, treeSelectionModel ) => {
    if( _selectionSource === 'tree') {
        _selectionSource ='';
        return;
    }
    _selectionSource = 'gantt';

    if( ganttSelectionData && ganttSelectionData.selected ) {
        let treeNodes = filterTreeNodes( treeSelectionModel, ganttSelectionData.selected );
        if( treeNodes.length <= 0 && treeSelectionModel.getCurrentSelectedCount() <= 0 ) {
            _selectionSource = '';
        }
        treeSelectionModel.setSelection( treeNodes );
    }

    let treeNodes = convertModelObjectsToTreeNodes( treeSelectionModel, ganttSelectionData.selected );
    updateParentSelection( parentSelectionData, treeNodes );
};

const filterTreeNodes = ( selectionModel, modelObjects ) => {
    let treeNodes = [];
    let vmCollection = _.get( selectionModel.getDpListener(), 'vmCollectionObj.vmCollection' );

    if( modelObjects && vmCollection ) {
        modelObjects.forEach( modelObject => {
            let vmoIndex = vmCollection.findViewModelObjectById( modelObject.uid );
            if( vmoIndex > -1 ) {
                treeNodes.push( vmCollection.getViewModelObject( vmoIndex ) );
            }
        } );
    }
    return treeNodes;
};

const convertModelObjectsToTreeNodes = ( selectionModel, modelObjects ) => {
    let vmCollection = _.get( selectionModel.getDpListener(), 'vmCollectionObj.vmCollection' );
    if( !vmCollection ) {
        return modelObjects;
    }

    let treeNodes = modelObjects.map( modelObject => {
        let vmoIndex = vmCollection.findViewModelObjectById( modelObject.uid );
        return vmoIndex > -1 ? vmCollection.getViewModelObject( vmoIndex ) : modelObject;
    } );
    return treeNodes;
};

const updateParentSelection = ( parentSelectionData, selectedObjects ) => {
    if( parentSelectionData ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected : selectedObjects ? selectedObjects : [] } );
    }
};

export const setBaselinesToView = ( scheduleNavigationContext, eventData ) => {
    if( scheduleNavigationContext && eventData ) {
        scheduleNavigationContext.update( {
            ...scheduleNavigationContext.getValue(),
            baselineUids: Array.isArray( eventData.baselines ) ? eventData.baselines.map( vmo => vmo.uid ) : []
        } );
    }
};
