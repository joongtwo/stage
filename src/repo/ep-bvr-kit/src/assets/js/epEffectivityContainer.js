// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/*global
 define
 */
/**
 *
 * @module js/epEffectivityContainer
 */
import appCtxService from 'js/appCtxService';
import epEffectivityRow from 'js/epEffectivityRow';
import epEffectivitySummaryRow from 'js/epEffectivitySummaryRow';
import { constants as epEffectivityConstants } from 'js/epEffectivityConstants';
import $ from 'jquery';
import _ from 'lodash';



let summaryEffectivity = null;
let rowObjectHandlerList = [];
let currentEndItem = null;

const minimumNumberOfUnits = 74;
const WI_VALIDATE_EFFECTIVITY_OPERATION_ROW = '#wi-validateEffectivity-operationRow';
const WI_VALIDATE_EFFECTIVITY_SUMMARY_ROW = '#wi-validateEffectivity-summaryRow';
const WI_VALIDATE_EFFECTIVITY_NAME_OPERATION = '#wi-validateEffectivity-name-operation';
const WI_VALIDATE_EFFECTIVITY_NAME_SUMMARY = '#wi-validateEffectivity-name-summary';
const WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_OPERATION = '#wi-validateEffectivity-upCheckbox-operation';
const WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_SUMMARY = '#wi-validateEffectivity-upCheckbox-summary';


/**
 *
 * @param {Object} endItemToObjectDataMap end item to object data map
 * @param {Object} effectivityData effectivity data
 */
function drawUnitEffectivityGraph( endItemToObjectDataMap, validateEffectivityData, configData ) {
    const graphCanvas = document.querySelector( WI_VALIDATE_EFFECTIVITY_OPERATION_ROW );
    const graphCanvasSummaryRow = document.querySelector( WI_VALIDATE_EFFECTIVITY_SUMMARY_ROW );

    const operationNameElement = document.querySelector( WI_VALIDATE_EFFECTIVITY_NAME_OPERATION );
    const summaryNameElement = document.querySelector( WI_VALIDATE_EFFECTIVITY_NAME_SUMMARY );

    const operationUpCheckboxElement = document.querySelector( WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_OPERATION );
    const summaryUpCheckboxElement = document.querySelector( WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_SUMMARY );

    const unitEffectivityMinRange = endItemToObjectDataMap.minStartUnit;
    const unitEffectivityMaxRange = endItemToObjectDataMap.maxEndUnit > endItemToObjectDataMap.minStartUnit + minimumNumberOfUnits ?
        endItemToObjectDataMap.maxEndUnit : endItemToObjectDataMap.minStartUnit + minimumNumberOfUnits;

    _.forEach( endItemToObjectDataMap, function( object ) {
        if ( object ) {
            const effectivityRanges = object.effectivityUnitRanges;
            let objectConfiguration = {};
            objectConfiguration.object = object.object;
            objectConfiguration.effectivityObj = object.effectivityObj;
            objectConfiguration.layout = graphCanvas;
            objectConfiguration.operationNameElement = operationNameElement;
            objectConfiguration.operationUpCheckboxElement = operationUpCheckboxElement;
            objectConfiguration.minUnit = validateEffectivityData.min ? validateEffectivityData.min : unitEffectivityMinRange;
            objectConfiguration.maxUnit = validateEffectivityData.max ? validateEffectivityData.max : unitEffectivityMaxRange;
            objectConfiguration.effectivityRanges = effectivityRanges;
            objectConfiguration.isUP = object.isUp;
            objectConfiguration.isDirty = false;
            objectConfiguration.InheritedFrom = object.InheritedFrom;
            objectConfiguration.IsAligned = object.IsAligned;
            let objectEffectivity = epEffectivityRow.createObjectEffectivity( objectConfiguration );
            objectEffectivity.drawUnitEffectivityRow( validateEffectivityData, configData );
            rowObjectHandlerList.push( objectEffectivity );
        }
    } );


    // To draw summary row
    if ( endItemToObjectDataMap && endItemToObjectDataMap.length !== 0 ) {
        const summaryObject = {
            name: configData.rowName
        };
        let summaryConfiguration = {};
        summaryConfiguration.object = summaryObject;
        summaryConfiguration.selectedObjects = endItemToObjectDataMap.validObjects;
        summaryConfiguration.layout = graphCanvasSummaryRow;
        summaryConfiguration.summaryNameElement = summaryNameElement;
        summaryConfiguration.summaryUpCheckboxElement = summaryUpCheckboxElement;
        summaryConfiguration.minUnit = validateEffectivityData.min ? validateEffectivityData.min : unitEffectivityMinRange;
        summaryConfiguration.maxUnit = validateEffectivityData.max ? validateEffectivityData.max : unitEffectivityMaxRange;

        if ( isAnyRowWithUpEffectivity() ) {
            summaryConfiguration.isUP = true;
        } else {
            summaryConfiguration.isUP = false;
        }

        summaryEffectivity = epEffectivitySummaryRow.createSummaryEffectivity( summaryConfiguration );
        summaryEffectivity.drawSummaryRow( validateEffectivityData, configData );
    }
}

function destroyObject() {
    summaryEffectivity = null;
    rowObjectHandlerList = [];
    currentEndItem = null;
}

function isAnyRowWithUpEffectivity() {
    let isUp = false;
    for ( let i = 0; i < rowObjectHandlerList.length; ++i ) {
        if ( rowObjectHandlerList[i].isUP ) {
            isUp = true;
            break;
        }
    }

    return isUp;
}

function summaryRowUpdate() {
    summaryEffectivity.isUP = isAnyRowWithUpEffectivity();
    summaryEffectivity.createSummaryUnitsStatusList();
}

function objectSliderDragEvent( objectUid ) {
    let rowObject = getRowObject( objectUid );
    rowObject.updateRanges();
    rowObject.objectSliderEventHandler();
    summaryEffectivity.createSummaryUnitsStatusList();
}

function getRowObject( objectUid ) {
    for ( let i = 0; i < rowObjectHandlerList.length; ++i ) {
        if ( rowObjectHandlerList[i].object.uid === objectUid ) {
            return rowObjectHandlerList[i];
        }
    }
}

function getUpdatedEffectivityData() {
    let rowObjectToEffectivityArray = [];
    _.forEach( rowObjectHandlerList, function( rowObject ) {
        let effectivityData = {
            object: rowObject.object,
            effectivityObj: rowObject.effectivityObj,
            effectivityString: rowObject.effectivityString,
            isDirty: rowObject.isDirty,
            InheritedFrom : rowObject.InheritedFrom,
            IsAligned : rowObject.IsAligned
        };
        rowObjectToEffectivityArray.push( effectivityData );
    } );
    return rowObjectToEffectivityArray;
}

/**
 *
 * @param {Object} endItemToObjectDataMap enn item to object data map
 * @param {Object} effectivityData effectivity data
 */
function refreshEffectivityContainer( endItemToObjectDataMap, validateEffectivityData, configData ) {
    summaryEffectivity = null;
    rowObjectHandlerList = [];
    $( WI_VALIDATE_EFFECTIVITY_OPERATION_ROW ).empty();
    $( WI_VALIDATE_EFFECTIVITY_SUMMARY_ROW ).empty();
    $( WI_VALIDATE_EFFECTIVITY_NAME_OPERATION ).empty();
    $( WI_VALIDATE_EFFECTIVITY_NAME_SUMMARY ).empty();
    $( WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_OPERATION ).empty();
    $( WI_VALIDATE_EFFECTIVITY_UP_CHECKBOX_SUMMARY ).empty();
    drawUnitEffectivityGraph( endItemToObjectDataMap, validateEffectivityData, configData );
}

function setEndItem( selectedEndItem ) {
    currentEndItem = selectedEndItem;
}

function getEndItem() {
    return currentEndItem;
}

function hasEffectivityUpdated() {
    return appCtxService.getCtx( epEffectivityConstants.EP_EFFECTIVITY_IS_DIRTY );
}

function updateDirtyFlagOfRowObject( objectUid, flag ) {
    for ( let i = 0; i < rowObjectHandlerList.length; ++i ) {
        if ( rowObjectHandlerList[i].object.uid === objectUid ) {
            rowObjectHandlerList[i].isDirty = flag;
            break;
        }
    }
}

const exports = {
    destroyObject,
    drawUnitEffectivityGraph,
    hasEffectivityUpdated,
    getEndItem,
    getUpdatedEffectivityData,
    objectSliderDragEvent,
    refreshEffectivityContainer,
    setEndItem,
    summaryRowUpdate,
    updateDirtyFlagOfRowObject
};

export default exports;
