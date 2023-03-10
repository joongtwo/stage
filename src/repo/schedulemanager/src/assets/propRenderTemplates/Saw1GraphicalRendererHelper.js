// Copyright (c) 2022 Siemens

/**
 * Helper class for graphical renderer for Schedule Manager
 *
 * @module propRenderTemplates/Saw1GraphicalRendererHelper
 */
import { getBaseUrlPath } from 'app';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxService from 'js/appCtxService';
import smConstants from 'js/ScheduleManagerConstants';
import schNavigationDepCacheService from 'js/ScheduleNavigationDependencyCacheService';
import scheduleNavigationTreeRowService from 'js/scheduleNavigationTreeRowService';

var exports = {};

/*
 * @param { Object } vmo - ViewModelObject for which status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderStatusFlags = function( vmo, containerElem ) {
    let uid = vmo.uid;
    if( vmo.type === 'Awp0XRTObjectSetRow' && vmo.props.awp0Target ) {
        uid = vmo.props.awp0Target.dbValues[ 0 ];
    }

    let object = cdm.getObject( uid );
    if( object.props && object.props.fnd0status ) {
        if( cmm.isInstanceOf( 'ScheduleTask', object.modelType ) || cmm.isInstanceOf( 'Fnd0ProxyTask', object.modelType ) ) {
            let dbValue = object.props.fnd0status.dbValues;
            let displayValue = object.props.fnd0status.uiValues;
            let childElement = getContainerElement( dbValue, displayValue, smConstants.SCHEDULE_TASK_RENDERER_STATUS_ICON_MAP );
            containerElem.appendChild( childElement );
        } else {
            let childElement = document.createElement( 'div' );
            childElement.className = 'aw-splm-tableCellText';
            let displayValue = object.props.fnd0status.uiValues;
            childElement.innerHTML += displayValue;
            containerElem.appendChild( childElement );
        }
    }
};

/*
 * @param { Object } vmo - ViewModelObject for which state is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderStateFlags = function( vmo, containerElem ) {
    let uid = vmo.uid;
    if( vmo.type === 'Awp0XRTObjectSetRow' && vmo.props.awp0Target ) {
        uid = vmo.props.awp0Target.dbValues[ 0 ];
    }

    let object = cdm.getObject( uid );
    if( object.props && object.props.fnd0state ) {
        if( cmm.isInstanceOf( 'ScheduleTask', object.modelType ) ) {
            let dbValue = object.props.fnd0state.dbValues;
            let displayValue = object.props.fnd0state.uiValues;
            let childElement = getContainerElement( dbValue, displayValue, smConstants.SCHEDULE_TASK_RENDERER_STATE_ICON_MAP );
            containerElem.appendChild( childElement );
        } else {
            let childElement = document.createElement( 'div' );
            childElement.className = 'aw-splm-tableCellText';
            let displayValue = object.props.fnd0state.uiValue;
            childElement.innerHTML += displayValue;
            containerElem.appendChild( childElement );
        }
    }
};

/*
 * @param { Object } vmo - ViewModelObject for which state is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderRowNumbers = function( vmo, containerElem ) {
    if( appCtxService.ctx && appCtxService.ctx.scheduleNavigationCtx && appCtxService.ctx.scheduleNavigationCtx.treeNodeUids && appCtxService.ctx.scheduleNavigationCtx.treeNodeUids.length > 0 ) {
        var cacheTreeNode = appCtxService.ctx.scheduleNavigationCtx.treeNodeUids;
        var index = cacheTreeNode.indexOf( vmo.uid );
        var rowNumber = index + 1;
        let taskDepDispValue = rowNumber.toString();
        let childElement = document.createElement( 'div' );
        childElement.className = 'aw-splm-tableCellText';
        childElement.innerHTML += taskDepDispValue;
        containerElem.appendChild( childElement );
    }
};

/*
 * @param { Object } vmo - ViewModelObject for which state is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderPredecessors = function( vmo, containerElem ) {
    let predecessorsNumber = schNavigationDepCacheService.getTaskPredDependencies( vmo.uid );
    let taskDepDispValue = '';
    if( predecessorsNumber !== undefined && predecessorsNumber.displayValues && predecessorsNumber.displayValues.length !== 0 ) {
        for( var i = 0; i < predecessorsNumber.displayValues.length; ++i ) {
            taskDepDispValue += predecessorsNumber.displayValues[i];
            if( i !== predecessorsNumber.displayValues.length - 1 ) {
                taskDepDispValue += ',';
            }
        }
    }
    if( vmo && vmo.props && vmo.props.saw1Predecessors && vmo.props.saw1Predecessors.dbValue !== null  &&  taskDepDispValue !== vmo.props.saw1Predecessors.dbValue ) {
        if( vmo.props.saw1Predecessors.displayValues[0] !== vmo.props.saw1Predecessors.prevDisplayValues[0] ) {
            taskDepDispValue = scheduleNavigationTreeRowService.saveDependencyEdits( vmo, 'saw1Predecessors', taskDepDispValue, vmo.props.saw1Predecessors.dbValue );
        }
    }
    let childElement = document.createElement( 'div' );
    childElement.className = 'aw-splm-tableCellText';
    //Fix to remove grey box in the cell.
    if( taskDepDispValue === '' ) {
        taskDepDispValue = ' ';
    }
    childElement.innerHTML += taskDepDispValue;
    containerElem.appendChild( childElement );
};

/*
 * @param { Object } vmo - ViewModelObject for which state is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderSuccessors = function( vmo, containerElem ) {
    let successorsNumber = schNavigationDepCacheService.getTaskSuccDependencies( vmo.uid );
    let taskDepDispValue = '';
    if( successorsNumber !== undefined && successorsNumber.displayValues && successorsNumber.displayValues.length !== 0 ) {
        for( var i = 0; i < successorsNumber.displayValues.length; ++i ) {
            taskDepDispValue += successorsNumber.displayValues[i];
            if( i !== successorsNumber.displayValues.length - 1 ) {
                taskDepDispValue += ',';
            }
        }
    }
    if( vmo && vmo.props && vmo.props.saw1Successors && vmo.props.saw1Successors.dbValue !== null && taskDepDispValue !== vmo.props.saw1Successors.dbValue ) {
        if( vmo.props.saw1Successors.displayValues[0] !== vmo.props.saw1Successors.prevDisplayValues[0] ) {
            taskDepDispValue = scheduleNavigationTreeRowService.saveDependencyEdits( vmo, 'saw1Successors', taskDepDispValue, vmo.props.saw1Successors.dbValue );
        }
    }
    let childElement = document.createElement( 'div' );
    childElement.className = 'aw-splm-tableCellText';
    //Fix to remove grey box in the cell.
    if( taskDepDispValue === '' ) {
        taskDepDispValue = ' ';
    }
    childElement.innerHTML += taskDepDispValue;
    containerElem.appendChild( childElement );
};

var getContainerElement = function( internalName, dispName, constantMap ) {
    let childElement = document.createElement( 'div' );
    if( constantMap[ internalName ] ) {
        let imageElement = document.createElement( 'img' );
        imageElement.className = 'aw-visual-indicator';
        let imagePath = getBaseUrlPath() + '/image/';
        imageElement.title = dispName;
        imagePath += constantMap[ internalName ];
        imageElement.src = imagePath;
        imageElement.alt = dispName;
        childElement.appendChild( imageElement );
    }
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += dispName;
    return childElement;
};

export default exports = {
    renderStatusFlags,
    renderStateFlags,
    renderRowNumbers,
    renderSuccessors,
    renderPredecessors
};
