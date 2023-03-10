// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Pgp0PlanNavigationTreeService
 */
import _ from 'lodash';

export const updateTheFocussedComponent = localSelectionData => {
    if( localSelectionData && localSelectionData.selected ) {
        return localSelectionData.id;
    }
};

const updateParentSelection = ( parentSelectionData, selectedObjects ) => {
    if( parentSelectionData ) {
        parentSelectionData.update( { ...parentSelectionData.getValue(), selected : selectedObjects ? selectedObjects : [] } );
    }
};

export const handleExclusiveSelectionForTree = ( treeSelectionData, parentSelectionData, atomicDataRef ) => {
    if( treeSelectionData && parentSelectionData && treeSelectionData.selected ) {
        if( treeSelectionData.selected.length > 0 ) {
            atomicDataRef.timelineSelectionData.setAtomicData( { id: 'timelineSelectionModel', selected: [] } );
        }
        updateParentSelection( parentSelectionData, treeSelectionData.selected );
    }
};

export const handleExclusiveSelectionForTimeline = ( timelineSelectionData, parentSelectionData, treeSelectionModel ) => {
    if( timelineSelectionData && parentSelectionData && timelineSelectionData.selected ) {
        if( timelineSelectionData.selected.length > 0 ) {
            treeSelectionModel.selectNone();
        }
        updateParentSelection( parentSelectionData, timelineSelectionData.selected );
    }
};
