// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Item Report Configuration related method execution only.
 *
 *
 * @module js/configureItemReportService
 */
import appCtxService from 'js/appCtxService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import repCommonSrvc from 'js/reportsCommonService';
import showRepSrvc from 'js/showReportService';
import uwPropSrv from 'js/uwPropertyService';
import messagingService from 'js/messagingService';
import addObjectUtils from 'js/addObjectUtils';
import awsearchsrvc from 'js/awSearchService';
import AwPromiseService from 'js/awPromiseService';
import popUpSvc from 'js/popupService';

var exports = {};

var processRemoveClassSampleAction = function( data, reportParams ) {
    data.rootClassSample = [];
    data.dataProviders.rootClassSampleProvider.update( data.rootClassSample );
    if( reportParams.rootSampleObjectSelected ) {
        delete reportParams.rootSampleObjectSelected;
    }

    data.reportsContext.segmentTree = [];
    data.reportsContext.segments = [];
    if( reportParams.ReportDefProps && reportParams.ReportDefProps.ReportSegmentParams ) {
        delete reportParams.ReportDefProps.ReportSegmentParams;
    }

    if( reportParams.ReportDefProps && reportParams.ReportDefProps.ReportClassParameters ) {
        delete reportParams.ReportDefProps.ReportClassParameters;
    }

    if( reportParams.segments ) {
        delete reportParams.segments;
    }
    if( reportParams.ReportDefProps.ReportChart1 ) {
        delete reportParams.ReportDefProps.ReportChart1;
    }
    if( reportParams.ReportDefProps.ReportChart2 ) {
        delete reportParams.ReportDefProps.ReportChart2;
    }
    if( reportParams.ReportDefProps.ReportChart3 ) {
        delete reportParams.ReportDefProps.ReportChart3;
    }
    if( reportParams.ReportDefProps.ReportTable1 ) {
        delete reportParams.ReportDefProps.ReportTable1;
    }
    data.recreateSegementsPanel = true;
    appCtxService.updatePartialCtx( 'ReportsContext.reportParameters.bomInSegmentAdded', false );
    appCtxService.updatePartialCtx( 'ReportsContext.reportParameters', reportParams );
};

export let continueClassRemoveAction = function( ctx, repCtx ) {
    ctx = { ...ctx, reportsContext:repCtx };
    var reportParams = appCtxService.getCtx( 'ReportsContext.reportParameters' );

    let nwrepCtx = { ...repCtx.value };
    nwrepCtx.rootClassObject = [];
    nwrepCtx.rootClassSampleObject = [];
    nwrepCtx.segments = [];
    nwrepCtx.segmentTree = [];
    repCtx.update( nwrepCtx );

    processRemoveClassSampleAction( ctx, reportParams );
};

export let continueSampleObjectRemoveAction = function( ctx, repCtx ) {
    ctx = { ...ctx, reportsContext:repCtx };
    var reportParams = appCtxService.getCtx( 'ReportsContext.reportParameters' );

    let nwrepCtx = { ...repCtx.value };
    nwrepCtx.rootClassSampleObject = [];
    nwrepCtx.segments = [];
    nwrepCtx.segmentTree = [];
    repCtx.update( nwrepCtx );

    processRemoveClassSampleAction( ctx, reportParams );
};

/**
 * Get the last segment
 *
 * @param {Data} data - the data of the ViewModel
 * @returns {Segment} the last segment
 */
function getLastSegment( segments ) {
    if( segments && segments.length > 0 ) {
        return segments[ segments.length - 1 ];
    }
    return null;
}

/**
 * Setup's parameters for existing segments
 * @param {*} data   -
 */
function setSegmentParameters( segment, nwrepCtx ) {
    var segmentParams = appCtxService.getCtx( 'ReportsContext.reportParameters.ReportDefProps.ReportSegmentParams' );
    var needToCreateMoreSegment = false;
    if( segmentParams && nwrepCtx.segments.length < segmentParams.length ) {
        var index = nwrepCtx.segments.length;
        setDbAndUiValue( segment.props.fnd0RelationOrReference, segmentParams[ index ].RelOrRef );
        segment.props.fnd0RelationOrReference.valueUpdated = true;

        setDbAndUiValue( segment.props.fnd0Direction, segmentParams[ index ].Direction );
        segment.props.fnd0Direction.valueUpdated = true;

        setDbAndUiValue( segment.props.fnd0DestinationType, segmentParams[ index ].Destination );
        segment.props.fnd0DestinationType.selectedLovEntries = [ {
            propDisplayDescription: segmentParams[ index ].Destination
        } ];
        segment.props.fnd0DestinationType.valueUpdated = true;
        if( segmentParams[ index ].RelRefType === 'BOM' ) {
            segment.props.bomExpansionCheckbox.dbValue = true;
        }

        segment.existing = true;

        if( nwrepCtx.segments.length + 1 !== segmentParams.length ) {
            needToCreateMoreSegment = true;
        }
    }
    return needToCreateMoreSegment;
}

/**
 * Process segment creation and add
 *
 * @param {*} data
 */
export let processAndAddNewSegment = function( data, repContext ) {
    let nwrepCtx = { ...repContext.value };
    let segment = data.segment;

    var lastSeg = getLastSegment( nwrepCtx.segments );
    //var selectedRoot = appCtxService.getCtx( 'ReportsContext.reportParameters.rootSampleObjectSelected' );
    var rootType = nwrepCtx.rootClassSampleObject.length > 0  ? nwrepCtx.rootClassSampleObject[0].type : '';

    segment.props.fnd0SourceType.dbValue = lastSeg ? lastSeg.props.fnd0DestinationType.dbValue :
        rootType;

    segment.props.bomExpansionCheckbox = data.bomExpansionCheckbox;

    if ( lastSeg && lastSeg.props.bomExpansionCheckbox ) {
        segment.props.fnd0SourceType.dbValue = lastSeg.props.fnd0SourceType.dbValue;
        segment.props.fnd0SourceType.valueUpdated = true;
    } else {
        segment.props.fnd0SourceType.dbValue = lastSeg ? lastSeg.props.fnd0DestinationType.dbValue :
            rootType;
    }

    if( segment.props.fnd0SourceType && ( segment.props.fnd0SourceType.valueUpdated === false ||
            segment.props.fnd0SourceType.valueUpdated === undefined ) ) {
        segment.props.fnd0SourceType.valueUpdated = true;
    }

    segment.index = nwrepCtx.segments.length + 1;
    segment.caption = data.i18n.segment.format( nwrepCtx.segments.length + 1 );
    segment.props.fnd0Direction.isEditable = true;
    segment.props.fnd0SourceType.isEditable = true;
    segment.props.fnd0RelationOrReference.isEditable = true;
    segment.props.fnd0DestinationType.isEditable = true;
    if( segment.props.fnd0Direction && ( segment.props.fnd0Direction.valueUpdated === false ||
            segment.props.fnd0Direction.valueUpdated === undefined ) ) {
        segment.props.fnd0Direction.valueUpdated = true;
    }

    //data.segment.props.fnd0Direction.dbValue = 'true';
    segment.props.fnd0Direction.dbValue = true;
    segment.props.fnd0Direction.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
    segment.props.fnd0Direction.propertyRadioTrueText = data.i18n.forward;
    segment.props.fnd0Direction.propertyRadioFalseText = data.i18n.backward;

    if( segment.props.fnd0IncludedLO && ( segment.props.fnd0IncludedLO.valueUpdated === false ||
            segment.props.fnd0IncludedLO.valueUpdated === undefined ) ) {
        segment.props.fnd0IncludedLO.valueUpdated = true;
    }
    segment.props.fnd0IncludedLO.dbValue = 'true';

    //In case of Edit or re-openinging the panel
    //we need to set segment parameters.
    var needMoreSegment = setSegmentParameters( segment, nwrepCtx );
    nwrepCtx.segments.push( segment );
    repContext.update( nwrepCtx );

    //appCtxService.updatePartialCtx( 'ReportsContext.reportParameters.segments', data.segments );
    data.showSegment.dbValue = true;
    data.totalFound = 0;
    if( data.recreateSegementsPanel ) {
        data.recreateSegementsPanel = false;
    }

    exports.setCtxPayloadRevRule( appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0] );

    if( needMoreSegment ) {
        eventBus.publish( 'rb0segmentselector.addNewSegment' );
    } else if( data.segment.existing ) {
        eventBus.publish( 'rb0SegmentSelector.verifyTraversal' );
    }
    return nwrepCtx.segments;
};

/**
 * Set a segment's property with dbValue and uiValue
 *
 * @param {Object} prop - the property
 * @param {String} value - the value
 */
function setDbAndUiValue( prop, value ) {
    prop.dbValue = value;
    prop.uiValue = value;
    // prop.checked = value;
    return { ...prop };
}

/**
 * Clear the current segment
 *
 * @param {Data} data - the data of the ViewModel
 */
export let clearRelationSegment = function( segment, repContext ) {
    let repCtx = { ...repContext.getValue() };
    let vmo = repCtx.segments[segment.index - 1];
    if( vmo && vmo.existing ) {
        vmo.existing = false;
    } else {
        vmo.props.fnd0RelationOrReference = setDbAndUiValue( vmo.props.fnd0RelationOrReference, '' );
        vmo.props.fnd0DestinationType = setDbAndUiValue( vmo.props.fnd0DestinationType, '' );
    }
    repCtx.segments[segment.index - 1] = vmo;
    repContext.update( repCtx );
};

/**
 * @param reportContext - This might be response in case if it will called as output function
 * @param reportContext2 - This needs only for caller of output function
 */
export let getTraversalPath = function( repContext, repContext2  ) {
    //TODO: Need rework on this
    if( repContext2 ) {
        repContext = repContext2;
    }
    var traversePath = { relationsPath: [] };
    var ctxParams = appCtxService.getCtx( 'ReportsContext.reportParameters' );
    // var ctxParams = { ...repContext.value }
    if( !ctxParams?.ReportDefProps?.ReportSegmentParams ) {
        ctxParams = repContext.value ? repContext.value : repContext;
    }
    if( ctxParams.segments ) {
        ctxParams.segments.forEach( segment => {
            var segPayload;
            if( segment.props.bomExpansionCheckbox && segment.props.bomExpansionCheckbox.dbValue ) {
                segPayload = constructBomSegPayload( segment, ctxParams );
            } else {
                segPayload = constructNonBomSegPayload( segment, ctxParams );
            }
            traversePath.relationsPath.push( segPayload );
        } );
    } else if( ctxParams.ReportDefProps && ctxParams.ReportDefProps.ReportSegmentParams ) {
        ctxParams.ReportDefProps.ReportSegmentParams.forEach( segmentParam => {
            var segPayload = {};
            if( segmentParam.RelRefType === 'BOM' ) {
                segPayload = constructBomSegPayload( undefined, undefined, segmentParam );
            } else {
                segPayload = constructNonBomSegPayload( undefined, undefined, segmentParam );
            }
            traversePath.relationsPath.push( segPayload );
        } );
    }
    return JSON.stringify( traversePath );
};

export let callGetCategoriesForReports = function( response ) {
    return showRepSrvc.callRepGetCategories( response );
};

/**
 * Prepare and send segment tree.
 * TODO: Refactor to handle Segment tree creation from Context. Remove duplicate loop.
 *
 * @param {*} data -
 */
export let updateSegmentTree = function( data, i18nData ) {
    let i18n = data.i18n; let repContext = data.subPanelContext.reportsContext;
    var repParams = appCtxService.getCtx( 'ReportsContext.reportParameters' );
    var rootType;
    if( repContext ) {
        rootType = repContext.rootClassObject.length > 0 ? repContext.rootClassObject[0].props.object_string.dbValues[0] : '';
    } else {
        rootType = repParams.rootObjectSelected.props.object_string.dbValues[0];
    }
    data.dataforSegmentTree = [];
    var tree = {
        label: rootType + ' (' + i18n.parentSource + ')',
        value: rootType + ' (' + i18n.parentSource + ')',
        expanded: true,
        children: []
    };

    var nextNode = null;
    var segments = null;
    if( repContext ) {
        segments = repContext.segments ? repContext.segments.getValue() : repContext.segments;
    }

    if( repParams.ReportDefProps && repParams.ReportDefProps.ReportSegmentParams ) {
        _.forEach( repParams.ReportDefProps.ReportSegmentParams, function( segment ) {
            var node = {};
            node.label = segment.TreeVal;
            node.value = segment.TreeVal;
            node.expanded = true;
            node.children = [];
            if( nextNode === null ) {
                tree.children.push( node );
                nextNode = {
                    children: node.children
                };
            } else {
                nextNode.children.push( node );
                nextNode = node;
            }
        } );
        if( repContext ) {
            repContext.segmentTree = [ tree ];
            addObjectUtils.updateAtomicDataValue( repContext, { segmentTree:repContext.segmentTree } );
        }
        return [ tree ];
    } else if( segments && segments.length > 0 ) {
        _.forEach( segments, function( segment ) {
            var node = {};
            node.expanded = true;
            node.children = [];
            if( !segment.props.bomExpansionCheckbox || segment.props.bomExpansionCheckbox && !segment.props.bomExpansionCheckbox.dbValue ) {
                var objType = segment.props.fnd0DestinationType.selectedLovEntries[ 0 ].propDisplayDescription;
                var relRefValue = segment.props.fnd0RelationOrReference.dbValue;
                node.label = objType + ' (' + relRefValue + ')';
            }
            if( segment.props.bomExpansionCheckbox && segment.props.bomExpansionCheckbox.dbValue ) {
                node.label = i18nData.structure;
            }
            node.value = node.label;
            if( nextNode === null ) {
                tree.children.push( node );
                nextNode = {
                    children: node.children
                };
            } else {
                nextNode.children.push( node );
                nextNode = node;
            }
        } );
    }
    data.dataforSegmentTree.push( tree );
    if( repContext && tree.children && tree.children.length === 0 ) {
        repContext.segmentTree = [ tree ];
        addObjectUtils.updateAtomicDataValue( repContext, { segmentTree:repContext.segmentTree } );
    }
    return tree.children.length === 0 ? [ tree ] : repContext.segmentTree;
};

/**
 * Updates Tree Class, Sample and Tree when Saved Report is opened
 * for editing.
 * @param {*} data
 * @param {*} classTypeObject
 * @param {*} classSampleObject
 */
function setItemReportClassAndSampleACtion( data, subPanelCtx, classTypeObject, classSampleObject, i18nData ) {
    data.rootClass = [];
    var repContext = { ...subPanelCtx.reportsContext.getValue() };
    data.rootClass.push( classTypeObject );
    if( repContext.rootClassObject.length === 0 && data.dataProviders.rootClassProvider ) {
        data.dataProviders.rootClassProvider.update( data.rootClass );
        data.dataProviders.rootClassProvider.selectNone();
    } else if( repContext.rootClassObject.length > 0 && data.dataProviders.rootClassProvider ) {
        data.dataProviders.rootClassProvider.update( repContext.rootClassObject );
        data.dataProviders.rootClassProvider.selectNone();
    }

    var panelId;
    var panelTitle;
    if( classSampleObject !== null ) {
        data.rootClassSample = [];
        data.rootClassSample.push( classSampleObject );
        if( repContext.rootClassSampleObject.length === 0 && data.dataProviders.rootClassSampleProvider ) {
            data.dataProviders.rootClassSampleProvider.update( data.rootClassSample );
            data.dataProviders.rootClassSampleProvider.selectNone();
        } else if( repContext.rootClassSampleObject.length > 0 && data.dataProviders.rootClassSampleProvider ) {
            data.dataProviders.rootClassSampleProvider.update( repContext.rootClassSampleObject );
            data.dataProviders.rootClassSampleProvider.selectNone();
        }
        panelId = 'SetLayoutTabPage';
        panelTitle = data.i18n.layout;
    } else if( classSampleObject === null ) {
        panelId = 'Rb0RootSampleSelectorSub';
        panelTitle = data.i18n.selectSample;
    }

    if( !repContext.rootClassObject.length ) {
        repContext.rootClassObject.push( classTypeObject );
    }
    if( !repContext.rootClassSampleObject.length ) {
        repContext.rootClassSampleObject.push( classSampleObject );
    }
    repContext.segmentTree = updateSegmentTree( data, i18nData );
    subPanelCtx.reportsContext.update( repContext );
    callActiveViewChanges( subPanelCtx );
}

/**
 * Updates activeView
 * for editing.
 * @param {*} ctx
 * @param {*} subPnlCtx
 */
function callActiveViewChanges( subPnlCtx ) {
    var ctx = appCtxService.getCtx( '' );
    var editAndNotPreviewed = ctx.state.params.referenceId === 'edit' && ctx.ReportsContext.showPreview === false;
    var newAddAndPreviewed = ctx.state.params.referenceId === 'new' && ctx.ReportsContext.showPreview === true;
    if( !ctx.setLayoutTabPageReached && ( editAndNotPreviewed || newAddAndPreviewed ) && subPnlCtx.reportsContext.rootClassSampleObject[0] !== null ) {
        var nwrepCtx = subPnlCtx.reportsContext.getValue();
        if( subPnlCtx.reportsContext.segments.length === 0 ) {
            nwrepCtx.activeView = 'Rb0SegmentsSelectorSub';
        } else if( subPnlCtx.reportsContext.segments.length > 0 ) {
            nwrepCtx.activeView = 'SetLayoutTabPage';
            appCtxService.updatePartialCtx( 'setLayoutTabPageReached', true );
        }
        subPnlCtx.reportsContext.update( nwrepCtx );
    }
}

/**
 *
 * Setups the Configure Template panel.
 * @param {*} data-
 * @param {*} ctx-
 */
export let setupConfigureItemRepPanel = function( data, ctx, subPnlCtx, i18nData ) {
    var repParams = ctx.ReportsContext.reportParameters;
    if( repParams && repParams.rootObjectSelected && repParams.rootSampleObjectSelected ) {
        setItemReportClassAndSampleACtion( data, subPnlCtx, repParams.rootObjectSelected, repParams.rootSampleObjectSelected, i18nData );
    } else if( repParams && repParams.ReportDefProps && repParams.ReportDefProps.ReportClassParameters.rootClassUid && repParams.ReportDefProps.ReportClassParameters.rootSampleUid ) {
        dmSvc.loadObjects( [ repParams.ReportDefProps.ReportClassParameters.rootClassUid, repParams.ReportDefProps.ReportClassParameters.rootSampleUid ] ).then( function() {
            repParams.rootObjectSelected = cdm.getObject( repParams.ReportDefProps.ReportClassParameters.rootClassUid );
            repParams.rootSampleObjectSelected = cdm.getObject( repParams.ReportDefProps.ReportClassParameters.rootSampleUid );
            setItemReportClassAndSampleACtion( data, subPnlCtx, repParams.rootObjectSelected, repParams.rootSampleObjectSelected, i18nData );
            appCtxService.updatePartialCtx( 'ReportsContext.reportParameters', repParams );
        },
        function( ) {
            repParams.rootObjectSelected = cdm.getObject( repParams.ReportDefProps.ReportClassParameters.rootClassUid );
            repParams.rootSampleObjectSelected = cdm.getObject( repParams.ReportDefProps.ReportClassParameters.rootSampleUid );
            setItemReportClassAndSampleACtion( data, subPnlCtx, repParams.rootObjectSelected, repParams.rootSampleObjectSelected, i18nData );
            appCtxService.updatePartialCtx( 'ReportsContext.reportParameters', repParams );
            if( repParams.rootSampleObjectSelected === null ) {
                messagingService.reportNotyMessage( data, data._internal.messages, 'showSampleObjectMissingMessage' );
            }
        } );
    }
};

/**
 *
 * @param {*} data
 */
export let buildSegmentTreeAndNavigate = function( data, i18nData ) {
    var repParams = appCtxService.getCtx( 'ReportsContext.reportParameters' );
    if( !data.segments ) {
        data.segments = data.subPanelContext.reportsContext.segments;
    }
    if( repParams.ReportDefProps && repParams.ReportDefProps.ReportSegmentParams && repParams.ReportDefProps.ReportSegmentParams.length < data.segments.length ) {
        for( var i = repParams.ReportDefProps.ReportSegmentParams.length; i < data.segments.length; i++ ) {
            var segment = data.segments[ i ];
            var objType = segment.props.fnd0DestinationType.selectedLovEntries[ 0 ].propDisplayDescription;
            var relRefValue = segment.props.fnd0RelationOrReference.dbValue;
            var label = objType + '(' + relRefValue + ')';
            repParams.ReportDefProps.ReportSegmentParams.push( {
                TreeVal: label
            } );
        }
        appCtxService.updatePartialCtx( 'ReportsContext.reportParameters', repParams );
    }
    return updateSegmentTree( data, i18nData );
};

export let initiateVerifyTraversal = function( repContext ) {
    let segments = { ...repContext.segments.value };
    var shouldInitTraversal = false;
    _.forEach( segments, function( segment ) {
        if( segment.props.fnd0RelationOrReference.dbValue && segment.props.fnd0RelationOrReference.dbValue.length > 0 &&
            segment.props.fnd0DestinationType.dbValue && segment.props.fnd0DestinationType.dbValue.length > 0  || segment.props.bomExpansionCheckbox.dbValue ) {
            shouldInitTraversal = true;
        } else if( shouldInitTraversal ) {
            shouldInitTraversal = false;
        }
    } );

    if( shouldInitTraversal ) {
        eventBus.publish( 'rb0SegmentSelector.verifyTraversal' );
    }
};

export let removeTraverseSegment = function( subPanelContext ) {
    let repContext = subPanelContext.reportsContext;
    if( repContext.segments && repContext.segments.length > 1 ) {
        repContext.segments.pop();
        repContext.segments.value.pop();
        repContext.update( repContext );
        eventBus.publish( 'rb0SegmentSelector.verifyTraversal' );
    }
};

export let updateConfigItemProps = function( data, ctx ) {
    if( ctx.ReportsContext.reportParameters && ctx.ReportsContext.reportParameters.ReportDefProps ) {
        if( ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart1 &&
            ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart1.ChartPropName !== data.chart1LabelTxt.dbValue ) {
            uwPropSrv.updateDisplayValues( data.chart1LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart1.ChartPropName ] );
            uwPropSrv.setValue( data.chart1LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart1.ChartPropName ] );
        }
        if( ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart2 &&
            ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart2.ChartPropName !== data.chart2LabelTxt.dbValue  ) {
            uwPropSrv.updateDisplayValues( data.chart2LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart2.ChartPropName ] );
            uwPropSrv.setValue( data.chart2LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart2.ChartPropName ] );
        }
        if( ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart3 &&
            ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart3.ChartPropName !== data.chart3LabelTxt.dbValue  ) {
            uwPropSrv.updateDisplayValues( data.chart3LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart3.ChartPropName ] );
            uwPropSrv.setValue( data.chart3LabelTxt, [ ctx.ReportsContext.reportParameters.ReportDefProps.ReportChart3.ChartPropName ] );
        }
    }
};

export let getselectedClassObject = function( reportsContext ) {
    let rootClass = [];
    if( reportsContext && reportsContext.rootClassObject.length > 0 ) {
        rootClass.push( reportsContext.value.rootClassObject[ 0 ] );
    }
    return { results: rootClass, totalFound: rootClass.length };
};

export let getselectedSampleObject = function( reportsContext, i18nData ) {
    let classSample = [];
    let segmentTree = [];
    if( reportsContext && reportsContext.rootClassSampleObject.length > 0 ) {
        classSample.push( reportsContext.value.rootClassSampleObject[ 0 ] );
        // Need to improve
        let data = { i18n:i18nData, subPanelContext:{ reportsContext:reportsContext } };
        segmentTree = updateSegmentTree( data, i18nData );
    }
    return { results: classSample, totalFound: classSample.length, tree: segmentTree };
};

export let setConfigurePanel = function( reportsContext, destPanel ) {
    let nwrepCtx = { ...reportsContext };
    nwrepCtx.activeView = destPanel;
    return nwrepCtx;
};

export let  processOutput = function( data, datactxNode, searchState ) {
    awsearchsrvc.processOutput( data, datactxNode, searchState );
};

export let updateSelectedLovEntries = function( eventData, repContext ) {
    let repCtx = { ...repContext.getValue() };
    var selectedObjects = eventData.selectedObjects;
    var vmo = eventData.vmo;
    var viewModelProp = eventData.viewModelProp;
    let updateProp = viewModelProp.propertyName;
    let updateSeg = repCtx.segments[vmo.index - 1].props[updateProp];
    updateSeg.selectedLovEntries = selectedObjects;
    repCtx.segments[vmo.index - 1].props[updateProp] = updateSeg;
    repContext.update( repCtx );
};

export let populateSegmentDataWithBomInfo = function( subPanelContext, checkbox ) {
    eventBus.publish( 'rb0SegmentSelector.verifyTraversal' );
};

let constructBomSegPayload = ( segment, ctxParams, dashboardSegmentParams ) => {
    if( !dashboardSegmentParams ) {
        return {
            searchMethod: repCommonSrvc.getRelationTraversalType( segment, ctxParams ),
            objectType: segment.props.fnd0SourceType.dbValue,
            revisionRule: exports.getCtxPayloadRevRule()
        };
    }
    return {
        searchMethod: dashboardSegmentParams.RelRefType,
        objectType: dashboardSegmentParams.Source,
        revisionRule: exports.getCtxPayloadRevRule()
    };
};

let constructNonBomSegPayload = ( segment, ctxParams, dashboardSegmentParams ) => {
    if( !dashboardSegmentParams ) {
        return {
            searchMethod: repCommonSrvc.getRelationTraversalType( segment, ctxParams ),
            relationName: segment.props.fnd0RelationOrReference.dbValue,
            objectType: segment.props.fnd0DestinationType.dbValue
        };
    }
    return {
        objectType: dashboardSegmentParams.Destination,
        relationName: dashboardSegmentParams.RelOrRef,
        searchMethod: dashboardSegmentParams.RelRefType
    };
};

export let showEditReportCriteria = ( popupData, commandData ) => {
    var deferred = AwPromiseService.instance.defer();
    popupData.subPanelContext = {};
    popupData.subPanelContext.revRuleLovList = commandData.revRuleLovList;
    var reportSearchCriteriaStr = appCtxService.getCtx( 'ReportsContext.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria' );
    var reportSearchCriteria = JSON.parse( reportSearchCriteriaStr );
    if( reportSearchCriteria.relationsPath && reportSearchCriteria.relationsPath.length > 0 && reportSearchCriteria.relationsPath[0].searchMethod === 'BOM' ) {
        var appliedRevRule = reportSearchCriteria.relationsPath[0].revisionRule === '' ? appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0] : reportSearchCriteria.relationsPath[0].revisionRule;
        popupData.subPanelContext.appliedRevRuleObj = _.find( commandData.revRuleLovList, ( revRuleObj ) => {
            return revRuleObj.propDisplayValue === appliedRevRule;
        } );
    }
    popUpSvc.show( popupData ).then( ( id ) => {
        appCtxService.updatePartialCtx( 'ReportsContext.criteriaPopupId', id );
        deferred.resolve( {} );
    } );
    return deferred.promise;
};

export let saveEditReportCriteria = ( revRuleProp )  => {
    var newRevRule = revRuleProp.displayValues[0];
    exports.setCtxPayloadRevRule( newRevRule );
    eventBus.publish( 'showReportImage.editReportCriteriaIssued' );
};

export let getRevRuleLovListFromLovValues = ( responseData ) => {
    var revRuleLovList = [];
    if( responseData && responseData.lovValues && responseData.lovValues.length > 0 ) {
        responseData.lovValues.map( ( revRuleObj ) => {
            if( revRuleObj.propDisplayValues && revRuleObj.propDisplayValues.object_name ) {
                var revRuleVMObj = {
                    propDisplayValue: revRuleObj.propDisplayValues.object_name[0],
                    propInternalValue: revRuleObj.uid,
                    dbValue: revRuleObj.uid,
                    uid:  revRuleObj.uid
                };
                revRuleLovList.push( revRuleVMObj );
            }
        } );
    }
    return revRuleLovList;
};

export let updateRevisionRuleLabel = ( appliedRevRule, i18n ) => {
    var newAppliedRevRule = _.clone( appliedRevRule );
    var searchCriteriaStr  = appCtxService.getCtx( 'ReportsContext.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria' );
    if( searchCriteriaStr && searchCriteriaStr.includes( 'searchMethod\":\"BOM' ) ) {
        var searchCriteriaJSON = JSON.parse( searchCriteriaStr );
        var relationsPath = _.find( searchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        var revRule = relationsPath.revisionRule ? relationsPath.revisionRule : appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0];
        newAppliedRevRule.uiValue = i18n.appliedRevRule + ': ' + revRule;
        newAppliedRevRule.dbValue = i18n.appliedRevRule + ': ' + revRule;
    }
    return newAppliedRevRule;
};

export let setCtxPayloadRevRule = ( newRevRule ) => {
    var reportsCtx = appCtxService.getCtx( 'ReportsContext' );
    if ( reportsCtx && reportsCtx.reportParameters && reportsCtx.reportParameters.ReportDefProps && reportsCtx.reportParameters.ReportDefProps.ReportSearchInfo ) {
        let existingSearchCriteiraString = reportsCtx.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
        let existingSearchCriteriaJSON = {};
        try {
            existingSearchCriteriaJSON = JSON.parse( existingSearchCriteiraString );
        } catch( e ) {
            //Incorrect data, don't set revRule
            return;
        }
        let bomSegIndex =  _.findIndex( existingSearchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        if( bomSegIndex >= 0 ) {
            existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule = newRevRule;
        }
        reportsCtx.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria = JSON.stringify( existingSearchCriteriaJSON );
    }
    appCtxService.registerCtx( 'ReportsContext', reportsCtx );
};

export let getCtxPayloadRevRule = () => {
    var reportsCtx = appCtxService.getCtx( 'ReportsContext' );
    if ( reportsCtx && reportsCtx.reportParameters && reportsCtx.reportParameters.ReportDefProps && reportsCtx.reportParameters.ReportDefProps.ReportSearchInfo ) {
        let existingSearchCriteiraString = reportsCtx.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
        let existingSearchCriteriaJSON = {};
        try {
            existingSearchCriteriaJSON  = JSON.parse( existingSearchCriteiraString );
        } catch( e ) {
            //incorrect data, return default value
            return '';
        }
        let bomSegIndex =  _.findIndex( existingSearchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        if( bomSegIndex >= 0 ) {
            return existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule;
        }
    }
    return appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0];
};

export let setSaveActionCompleteInContext = () => {
    appCtxService.updatePartialCtx( 'ReportsContext.saveReportConfigActionComplete', true );
};

export let updateDataProviderOnError = ( data, i18n ) => {
    data.noResults = true;
    data.noResultsFound = i18n;
};

/**
 * Service variable initialization
/**
 * @param {any} appCtxService - the
 * @param  {any} listBoxService - the
 *
 * @returns {any} exports - the Exports.
 */
export default exports = {
    continueClassRemoveAction,
    continueSampleObjectRemoveAction,
    processAndAddNewSegment,
    clearRelationSegment,
    getTraversalPath,
    callGetCategoriesForReports,
    updateSegmentTree,
    setupConfigureItemRepPanel,
    buildSegmentTreeAndNavigate,
    initiateVerifyTraversal,
    removeTraverseSegment,
    updateConfigItemProps,
    getselectedClassObject,
    getselectedSampleObject,
    setConfigurePanel,
    processOutput,
    updateSelectedLovEntries,
    populateSegmentDataWithBomInfo,
    showEditReportCriteria,
    saveEditReportCriteria,
    getRevRuleLovListFromLovValues,
    getCtxPayloadRevRule,
    updateRevisionRuleLabel,
    setCtxPayloadRevRule,
    setSaveActionCompleteInContext,
    updateDataProviderOnError
};
