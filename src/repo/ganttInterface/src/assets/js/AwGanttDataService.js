// Copyright (c) 2022 Siemens

import cdm from 'soa/kernel/clientDataModel';

/**
 * Interface for Gantt data transform service
 */
export class AwGanttDataService {
    constructor() {
        // To be initialized by the sub class.
        this.createFnMap = null;
        this.updateFnMap = null;
    }

    constructGanttObject( modelObject ) {
        let fnKey = null;
        if( modelObject.modelType && modelObject.modelType.typeHierarchyArray ) {
            // Walk the type hierarchy to find the nearest create function.
            fnKey = modelObject.modelType.typeHierarchyArray.find( type => this.createFnMap.has( type ) );
        }

        if( fnKey ) {
            return this.createFnMap.get( fnKey )( modelObject );
        }
    }

    updateGanttObject( modelObject, ganttInstance ) {
        let fnKey = null;
        if( modelObject.modelType && modelObject.modelType.typeHierarchyArray ) {
            // Walk the type hierarchy to find the nearest update function.
            fnKey = modelObject.modelType.typeHierarchyArray.find( type => this.updateFnMap.has( type ) );
        }

        if( fnKey && ( ganttInstance.isTaskExists( modelObject.uid ) || ganttInstance.isLinkExists( modelObject.uid )  ) ) {
            this.updateFnMap.get( fnKey )( modelObject, ganttInstance );
        }
    }
}

/**
 * Convenient method to create a gantt object.
 *
 * @param {String} uid of the gantt object to be created.
 * @returns the Gantt Object
 */
export const createGanttObject = ( uid ) => {
    return {
        id: uid,
        uid: uid,
        stackedObjectsUids: [],
        showLeftText: false,
        showRightText: false,
        getCssClass() {},
        getTooltipText( start, end, ganttTask, ganttInstance ) {},
        getTaskText( start, end, ganttTask, ganttInstance ) {},
        getLeftSideText( start, end, ganttTask, ganttInstance ) {},
        getRightSideText( start, end, ganttTask, ganttInstance ) {},
        getLeftSideValue( start, end, ganttTask, ganttInstance ) {},
        getRightSideValue( start, end, ganttTask, ganttInstance ) {},
        canDragStart() { return false; },
        canDragEnd() { return false; },
        canDragMove() { return false; },
        canDragProgress() { return false; },
        isBubbleCountSupported() { return false; },
        getStackedObjectsUids() { return this.stackedObjectsUids; },
        setStackedObjectsUids( stackedObjectsUids ) { return this.stackedObjectsUids = stackedObjectsUids; },
        getLocalValue( propName ) { if( this[ propName ] ) { return this[ propName ]; } },
        getDbValue( propName ) { return this.getTcValueInternal( propName, 'dbValues' ) && this.getTcValueInternal( propName, 'dbValues' )[ 0 ]; },
        getUiValue( propName ) { return this.getTcValueInternal( propName, 'uiValues' ) && this.getTcValueInternal( propName, 'uiValues' )[ 0 ]; },
        getDbValues( propName ) { return this.getTcValueInternal( propName, 'dbValues' ); },
        getUiValues( propName ) { return this.getTcValueInternal( propName, 'uiValues' ); },
        getTcValueInternal( propName, dbOrUiValues ) { // Must be either 'dbValues' or 'uiValues'
            let tcObject = cdm.getObject( this.uid );
            if( tcObject && tcObject.props[ propName ] && tcObject.props[ propName ][ dbOrUiValues ] ) {
                return tcObject.props[ propName ][ dbOrUiValues ];
            }
            console.log( propName + ' not found.' );
        }
    };
};

export default {
    createGanttObject
};
