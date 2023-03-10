// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/Dpv1QueryParamService
 * 
 */

 import appCtxSvc from 'js/appCtxService';
 import awTableService from 'js/awTableService';
 import browserUtils from 'js/browserUtils';
 import _localeSvc from 'js/localeService';
 import AwHttpService from 'js/awHttpService';
 import AwPromiseService from 'js/awPromiseService';

 import modelPropertySvc from 'js/modelPropertyService';
 import dateTimeService from 'js/dateTimeService';
 import _ from 'lodash';
 
var exports = {};

export let updateLastNJobs = function( qryTypeState, lastNJobsVal ) {
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.lastNJobs = lastNJobsVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateDaysJob = function( qryTypeState, lastJobsDaysVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.lastJobsDays = lastJobsDaysVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateHrsJob = function( qryTypeState, lastJobsHrsVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.lastJobsHrs = lastJobsHrsVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateMinsJob = function( qryTypeState, lastJobsMinsVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.lastJobsMins = lastJobsMinsVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateFromDate = function( qryTypeState, fromDateVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.fromDate = getUnixTime( fromDateVal );
    qryTypeState.update({ ...qryTypeData });
};

export let updateToDate = function( qryTypeState, toDateVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.toDate = getUnixTime( toDateVal );
    qryTypeState.update({ ...qryTypeData });
};

export let updateFromJob = function( qryTypeState, fromOrSingleJobVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.fromOrSingleJob = fromOrSingleJobVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateToJob = function( qryTypeState, toJobVal ){
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.toJob = toJobVal;
    qryTypeState.update({ ...qryTypeData });
};

//chart settings

export let updateYAxisToSpecLimit =  function( state, toSpecLimitVal ){
    let stateData = { ...state.value };
    stateData.toSpecLimit = toSpecLimitVal;
    state.update({ ...stateData });
};

export let updateYAxisFromUserDefined =  function( state, fromUserDefinedVal ){
    let stateData = { ...state.value };
    stateData.fromUserDefined = fromUserDefinedVal;
    state.update({ ...stateData });
};

export let updateYAxisToUserDefined =  function( state, toUserDefinedVal ){
    let stateData = { ...state.value };
    stateData.toUserDefined = toUserDefinedVal;
    state.update({ ...stateData });
};

export let updateUserDefinedOption = function( state, userDefinedOptionVal ){
    let stateData = { ...state.value };
    stateData.userDefinedOption = userDefinedOptionVal;
    state.update({ ...stateData });
};

export let updateIncludeZero = function( state, includeZeroVal ) {
    let stateData = { ...state.value };
    stateData.autoIncludeZero = includeZeroVal;
    state.update({ ...stateData });
};

export let updateAnnotationColorBox = function( state, annColoxBoxVal ){
    let stateData = { ...state.value };
    stateData.annotationColorBox = annColoxBoxVal;
    state.update({ ...stateData });
};

export let updateAnnotationRed = function( state, annRedVal ){
    let stateData = { ...state.value };
    stateData.annotationRed = annRedVal;
    state.update({ ...stateData });
};

export let updateAnnotationGreen = function( state, annGreenVal ){
    let stateData = { ...state.value };
    stateData.annotationGreen = annGreenVal;
    state.update({ ...stateData });
};

export let updateBarChartScopeGreen = function( state, barChartScopeGreenVal ){
    let stateData = { ...state.value };
    stateData.barChartScopeGreen = barChartScopeGreenVal;
    state.update({ ...stateData });
};

export let updateBarChartScopeRed = function(state, barChartScopeRedVal ){
    let stateData = { ...state.value };
    stateData.barChartScopeRed = barChartScopeRedVal;
    state.update({ ...stateData });
};

export let updateBarChartScopeBlack = function(state, barChartScopeBlackVal ){
    let stateData = { ...state.value };
    stateData.barChartScopeBlack = barChartScopeBlackVal;
    state.update({ ...stateData });
};

export let updateBasisAndAnnColors = function( data, state ){
    let stateData = { ...state.value };
    let basisVal = data.basis.dbValue;
    stateData.basis = basisVal;
    if( basisVal === "0" || basisVal === "4" || basisVal === "5" || basisVal === "6" )
    {
        stateData.annotationGreen = "1.33";
        stateData.annotationRed = "1";
    }
    else if( basisVal === "1" || basisVal === "2" || basisVal === "8" )
    {
        stateData.annotationGreen = "2";
        stateData.annotationRed = "3";
    }
    else if( basisVal === "3" )
    {
        stateData.annotationGreen = "95";
        stateData.annotationRed = "75";
    }
    else if( basisVal === "7" )
    {
        stateData.annotationGreen = "5";
        stateData.annotationRed = "25";
    }
    else if( basisVal === "9" )
    {
        stateData.annotationGreen = "0.33";
        stateData.annotationRed = "0.5";
    }
    else if( basisVal === "10" )
    {
        stateData.annotationGreen = "75";
        stateData.annotationRed = "100";
    }
    state.update({ ...stateData });
    let annotationGreen = _.clone( data.annotationGreen );
    let annotationRed = _.clone( data.annotationRed );
    annotationGreen.dbValue = stateData.annotationGreen;
    annotationRed.dbValue = stateData.annotationRed;
    return { "annotationGreen" : annotationGreen,
        "annotationRed" : annotationRed };
};

//statistics

// Used for Feature Attribute Table and Feature Table
export let loadStatAttributesColumn = function( index ) {
    var statAttributes = [];
    
    var start= (index*8)+1;
    var end= start+8;

    var resource = 'DpvMessages';
    var dpvTextBundle = _localeSvc.getLoadedText( resource );
    for( var idx = start; idx < end; idx++ ) {
        var key = "StatisticsAttr"+idx;
        var statAttr =  {
            "displayName": dpvTextBundle[key],
            "type": "BOOLEAN",
            "isRequired": "false",
            "isEditable": "true",
            "dbValue": false,
            "dispValue": key,
            "labelPosition": "PROPERTY_LABEL_AT_RIGHT"
        };
        var prop = modelPropertySvc.createViewModelProperty( statAttr );
        prop.internalValue = key;

        statAttributes.push(prop);
    }
  
    var response = {
        searchResults: statAttributes,
        totalFound:statAttributes.length
    };
    return response;
};

// Selection/Deselection in Feature Attribute Table and Feature Table 
export let selectStatFeature = function ( searchResults, statFeatureState ) {
    let stateData = { ...statFeatureState.value };
    var len = searchResults.length;
    for (var x = 0; x < len; x++) {
        var selAttrValue = searchResults[x].internalValue;
        selAttrValue = selAttrValue.substring(14);
        if ( searchResults[x].dbValue && !stateData.selectedFeatAttributes.includes(selAttrValue) ) {
            // add array element
            stateData.selectedFeatAttributes.push(selAttrValue);
            statFeatureState.update({ ...stateData });
            break;
        } else if ( !searchResults[x].dbValue && stateData.selectedFeatAttributes.includes(selAttrValue) ) {
            // remove array element
            stateData.selectedFeatAttributes = stateData.selectedFeatAttributes.filter(item => item !== selAttrValue);
            statFeatureState.update({ ...stateData });
            break;
        }
    }
};

export let loadFeatureAttrTypes = function( statFeatureState ) {
    var statAttributes = [];
    _.forEach( statFeatureState.featAttrTypes, function( featAttrType ) {
        statAttributes.push( {
            "propDisplayValue": featAttrType,
            "propInternalValue": featAttrType
        } );
    });
  
    var response = {
        "featAttrTypelistBoxValues": statAttributes
    };
    return response;
};

export let loadFeatureOptions = function() {
    var statOptions = [];
    var resource = 'DpvMessages';
    var dpvTextBundle = _localeSvc.getLoadedText( resource );
    for( var idx = 1; idx <= 4; idx++ ) {
        var key = "FeatOption"+idx;
        var statOption =  {
            "propDisplayValue": dpvTextBundle[key],
            "propInternalValue": idx
        };
        statOptions.push( statOption );
    }
  
    var response = {
        "featOptionslistBoxValues": statOptions
    };
    return response;
};

export let updateFeatAttrTypeList = function( featAttrTypesListBox, statFeatureState ) {
    let featAttrTypesListBoxCopy = _.cloneDeep( featAttrTypesListBox );
    let stateData = { ...statFeatureState.value };
    //clear the array first
    stateData.selectedFeatAttrTypes.splice(0,stateData.selectedFeatAttrTypes.length);
    _.forEach( featAttrTypesListBoxCopy.dbValue, function( featAttrType ) {
        stateData.selectedFeatAttrTypes.push( featAttrType );
    } );
    statFeatureState.update({ ...stateData });
};

export let updateFeatOptionsList = function( featOptionslistBox, statFeatureState ) {
    let featOptionslistBoxCopy = _.cloneDeep( featOptionslistBox );
    let stateData = { ...statFeatureState.value };
    //clear the array first
    stateData.selectedFeatOptions.splice(0,stateData.selectedFeatOptions.length);
    _.forEach( featOptionslistBoxCopy.dbValue, function( featOption ) {
        stateData.selectedFeatOptions.push( featOption );
    } );
    statFeatureState.update({ ...stateData });
};

function getUnixTime( dateObject ) {
    var dateTime;

    if( !dateObject ) {
        return dateTime;
    }

    if( _.isString( dateObject ) || _.isNumber( dateObject ) ) {
        dateTime = dateObject;
    } else {
        var offsetInMs = ((dateObject.getTimezoneOffset() * 60) * 1000);
        var utcDate = new Date(dateObject.getTime() + offsetInMs );
        dateTime = Math.floor(utcDate.getTime() / 1000);
    }
    
    return dateTime;
}

function getRequestURL(data) {

    var repTemplateUid = appCtxSvc.ctx.mselected[0].uid;

    var microserviceURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/execute/" + repTemplateUid;

    //Akshay: Bug: Chart settings parameters part of the URL even if original settings checkbox is not selected.
    var cChartType = "";
    var cXAxisLabel = "";
    var cYAxisLabel = "";
    var cYAxisToSpecLimit = "";
    var cYAxisToUserDefined = "";
    var cYAxisFromUserDefined = "";
    var cUserDefinedOption = "";
    var cIncludeZeroCheckbox = "";

    //Annotation
    var cAnnotationColorBox = "";
    var cAnnotationGreen = "";
    var cAnnotationRed = "";
    var cBasis = "";

    //Bar chart color scope: Red, Green and Black
    var cBarChartScopeGreen = "";
    var cBarChartScopeRed = "";
    var cBarChartScopeBlack = "";
    
    var featOptionsVal = "";
    var featAttrTypesListVal = "";
    var featTableValString = "";
    var featAttrTableValString = "";

    var cDeviceType = "";
    var cSpecType = "";
    var cTraceCode = "";
    var cRoutineID = "";

    var cRepExecPriority = data.repExecPriority.dbValue;

    var reportURL = microserviceURL + "?rp=\"" + cRepExecPriority + "\""; // default

    if ( !data.qryTypeState.useOrigTempSettings ) {
        var cShift = data.qryTypeState.shift;
        var queryType = data.qryTypeState.qryType;

        if (queryType === '0') //Last Number of Jobs
        {
            var cLastJobs = data.qryTypeState.lastNJobs;

            //form URL for last N jobs
            reportURL = reportURL + "\"&sh=\"" + cShift + "\"&qt=\"" + queryType;
            reportURL = reportURL + "\"&nj=\"" + cLastJobs + "\"";
        }
        else if (queryType === '1') //Last Jobs based on time
        {
            var cDays = data.qryTypeState.lastJobsDays;
            var cHrs = data.qryTypeState.lastJobsHrs;
            var cMins = data.qryTypeState.lastJobsMins;
            //form URL for last jobs based on time
            reportURL = reportURL + "\"&sh=\"" + cShift + "\"&qt=\"" + queryType;
            reportURL = reportURL + "\"&d=\"" + cDays + "\"&h=\"" + cHrs + "\"&m=\"" + cMins + "\"";
        }
        else if (queryType === '2' || queryType === '3' || queryType === '4') {
            //capture fromDate and toDate
            var cfromDate = data.qryTypeState.fromDate;
            var ctoDate = data.qryTypeState.toDate;

            //form URL with fromDate and toDate first
            reportURL = reportURL + "\"&sh=\"" + cShift + "\"&qt=\"" + queryType;
            reportURL = reportURL + "\"&fd=\"" + cfromDate + "\"&ed=\"" + ctoDate;

            if (queryType === '3') //Job Range
            {
                var cfromJob = data.qryTypeState.fromOrSingleJob;
                var ctoJob = data.qryTypeState.toJob;
                //proceed and form URL with fJ & TJ
                reportURL = reportURL + "\"&fj=\"" + cfromJob + "\"&tj=\"" + ctoJob;

            }
            else if (queryType === '4') ///Single Job
            {
                var cSingleJob = data.qryTypeState.fromOrSingleJob;
                //proceed and form URL with single JOb
                reportURL = reportURL + "\"&fj=\"" + cSingleJob;
            }
            reportURL = reportURL + "\"";
        }

        /**Chart Settings**/
        /**
                    1~              
                    1~
                    2~~~~~1~
                    0~75.00~100.00~0~
                    75.00~100.00~200.00~
        */
        //Akshay: Bug: Chart settings parameters part of the URL even if original settings checkbox is not selected.
        //Adding condition to check if useOrigTempSettings is selected in case of Chart settings.
        if ( !data.chartSettingsState.useOrigTempSettings ){
            cChartType = data.chartSettingsState.chartType;
            cXAxisLabel = data.chartSettingsState.xAxisLabels;
            cYAxisLabel = data.chartSettingsState.yAxisLabels;    
    
            if (cYAxisLabel === '1') {
                //1~~~~speclimit~~
                cYAxisToSpecLimit = data.chartSettingsState.toSpecLimit;
            }
            else if (cYAxisLabel === '0') {
                //0~uT~uF~dropdownVal~~~
                cYAxisToUserDefined = data.chartSettingsState.toUserDefined;
                cYAxisFromUserDefined = data.chartSettingsState.fromUserDefined;
                cUserDefinedOption = data.chartSettingsState.userDefinedOption;
            }
            else if (cYAxisLabel === '2') {
                //Auto checkbox
                //2~~~~~1~
                cIncludeZeroCheckbox = data.chartSettingsState.autoIncludeZero ? "1" : "0";
            }
            //Annotation
            cAnnotationColorBox = data.chartSettingsState.annotationColorBox ? "1" : "0";
            cAnnotationGreen = data.chartSettingsState.annotationGreen;
            cAnnotationRed = data.chartSettingsState.annotationRed;
            cBasis = data.chartSettingsState.basis;
    
            //Bar chart color scope: Red, Green and Black
            cBarChartScopeGreen = data.chartSettingsState.barChartScopeGreen;
            cBarChartScopeRed = data.chartSettingsState.barChartScopeRed;
            cBarChartScopeBlack = data.chartSettingsState.barChartScopeBlack;    
        }
        //feature Attribute Table
        featAttrTableValString = !data.statFeatureAttrState.useOrigTempSettings && data.statFeatureAttrState.selectedFeatAttributes.length > 0 ? data.statFeatureAttrState.selectedFeatAttributes.join(",") : "";

        // This if condition is needed due to possible framework issue related to selection
        if( !data.statFeatureState.useOrigTempSettings ) 
        {
            //feature table
            featOptionsVal = data.statFeatureState.selectedFeatOptions.length > 0 ? data.statFeatureState.selectedFeatOptions.join(",") : "";
    
            featAttrTypesListVal = data.statFeatureState.selectedFeatAttrTypes.length > 0 ? data.statFeatureState.selectedFeatAttrTypes.join(",") : "";
    
            featTableValString = data.statFeatureState.selectedFeatAttributes.length > 0 ? data.statFeatureState.selectedFeatAttributes.join(",") : "";
        }
        /**data filter**/
        cRoutineID = data.dataFilterState.routineId; 
        cDeviceType = data.dataFilterState.selectedDeviceType;
        if (cDeviceType !== "") {
            cDeviceType = cRoutineID + ":" + cDeviceType;
        }

        cSpecType = data.dataFilterState.selectedSpecType;
        if (cSpecType !== "") {
            cSpecType = cRoutineID + ":" + cSpecType;
        }
        //Need to pass these trace code as --> tracecode1,tracecode2,...tracecodeN in the URL
        cTraceCode = data.dataFilterState.selectedTraceCodes.length > 0 ? data.dataFilterState.selectedTraceCodes.join(",") : "";

        //<DeviceType>~<SpecType>~<TraceCodeVal1,TraceCodeVal2,TraceCodeValN>
        if (!data.chartSettingsState.useOrigTempSettings || !data.statFeatureAttrState.useOrigTempSettings ||
            !data.statFeatureState.useOrigTempSettings || !data.dataFilterState.useOrigTempSettings) {
                var additionalParams = "&ap=" + cChartType + "~" + cXAxisLabel + "~" + cYAxisLabel + "~";
                additionalParams += cYAxisToUserDefined + "~" + cYAxisFromUserDefined + "~" + cUserDefinedOption + "~";
                additionalParams += cYAxisToSpecLimit+ "~" + cIncludeZeroCheckbox + "~" + cAnnotationColorBox + "~";
                additionalParams += cAnnotationGreen + "~" + cAnnotationRed + "~" + cBasis + "~";
                additionalParams += cBarChartScopeGreen + "~" + cBarChartScopeRed + "~" + cBarChartScopeBlack + "~";
                additionalParams += featAttrTableValString + "~";
                additionalParams += featAttrTypesListVal + "~" + featOptionsVal + "~";
                additionalParams += featTableValString + "~";
                additionalParams += cDeviceType + "~" + cSpecType + "~" + cTraceCode;
                reportURL = reportURL + additionalParams;
        }
    }

    reportURL = reportURL.replace(/"/g, "");
    return reportURL;
}

export let generateReport = function( data ){ 

    var deferred = AwPromiseService.instance.defer();
    
    var url = getRequestURL( data );

    // for http request other than GET, we need to use AwHttpService. Its instance is $http.
    // So that the X-XSRF-TOKEN header can be set.
    var $http = AwHttpService.instance;

    var launchInfoInput = {
            "r" : "", "xid" : "",
            "rp" : 1,
            "sh": 0,
            "qt": 0,
            "nj": 0,
            "d": 0,
            "h": 0,
            "m": 0,
            "fd":"10/02/2020",
            "ed": "11/20/2020",
            "fj" :"",
            "tj" :"",
            "ap" : ""
    };

    window.open(url, '_blank');
    deferred.resolve(null);

    return deferred.promise;
};

export let updateQueryTypeOrigSettings = function( subPanelContext, origSettingsVal ) {
    var state = subPanelContext.qryTypeState;
    let stateData = { ...state.value };
    stateData.useOrigTempSettings = origSettingsVal;
    if( origSettingsVal ) {
        stateData.shift = "0";
        stateData.qryType = "0";
        stateData.lastNJobs = "20";
        stateData.lastJobsDays = "";
        stateData.lastJobsHrs = "";
        stateData.lastJobsMins = "";
        stateData.fromDate = "";
        stateData.toDate = "";
        stateData.fromOrSingleJob = "";
        stateData.toJob = "";
    }
    state.update({ ...stateData });
    if( origSettingsVal ) {
        exports.updateChartOrigSettings( subPanelContext.chartSettingsState, true );
        exports.updateStatFeatAttrOrigSettings( subPanelContext.statFeatureAttrState, true );
        exports.updateDataFilterOrigSettings( subPanelContext.dataFilterState, true );
        updateStatFeatState( subPanelContext.statFeatureState, true );
    }
};

export let updateChartOrigSettings = function( state, origSettingsVal ) {
    let stateData = { ...state.value };
    stateData.useOrigTempSettings = origSettingsVal;
    if( origSettingsVal ) {
        stateData.chartType = "1";
        stateData.xAxisLabels = "1";
        stateData.yAxisLabels = "2";
        stateData.toUserDefined = "";
        stateData.fromUserDefined = "";
        stateData.userDefinedOption = "0";
        stateData.toSpecLimit = "";
        stateData.autoIncludeZero = true;
        stateData.annotationColorBox = false;
        stateData.annotationGreen = "1.33";
        stateData.annotationRed = "1";
        stateData.basis = "0";
        stateData.barChartScopeGreen = "75";
        stateData.barChartScopeRed = "100";
        stateData.barChartScopeBlack = "200";
    }
    state.update({ ...stateData });
};

export let updateStatFeatAttrOrigSettings = function( state, origSettingsVal ) {
    let stateData = { ...state.value };
    stateData.useOrigTempSettings = origSettingsVal;
    if( origSettingsVal ) {
        stateData.selectedFeatAttributes.splice(0,stateData.selectedFeatAttributes.length);
    }
    state.update({ ...stateData });
};

export let updateStatFeatOrigSettings = function (data, state, origSettingsVal) {

    updateStatFeatState(state, origSettingsVal);

    let dataCopy = _.cloneDeep(data);

    dataCopy.featAttrTypelistBox.dbValues.splice(0, dataCopy.featAttrTypelistBox.dbValues.length);
    dataCopy.featAttrTypelistBox.displayValsModel.splice(0, dataCopy.featAttrTypelistBox.displayValsModel.length);
    dataCopy.featAttrTypelistBox.displayValues.splice(0, dataCopy.featAttrTypelistBox.displayValues.length);

    dataCopy.featAttrTypelistBox.uiValues.splice(0, dataCopy.featAttrTypelistBox.uiValues.length);
    dataCopy.featAttrTypelistBox.uiValue = "";

    dataCopy.featOptionslistBox.dbValues.splice(0, dataCopy.featOptionslistBox.dbValues.length);
    dataCopy.featOptionslistBox.displayValsModel.splice(0, dataCopy.featOptionslistBox.displayValsModel.length);
    dataCopy.featOptionslistBox.displayValues.splice(0, dataCopy.featOptionslistBox.displayValues.length);
    dataCopy.featOptionslistBox.uiValues.splice(0, dataCopy.featOptionslistBox.uiValues.length);

    dataCopy.featOptionslistBox.uiValue = "";

    return {
        "featAttrTypelistBox" : dataCopy.featAttrTypelistBox,
        "featOptionslistBox" : dataCopy.featOptionslistBox
    };
};

function updateStatFeatState(state, origSettingsVal) {
    let stateData = { ...state.value };
    stateData.useOrigTempSettings = origSettingsVal;
    
    if (origSettingsVal) {
        stateData.selectedFeatAttributes.splice(0, stateData.selectedFeatAttributes.length);
        stateData.selectedFeatAttrTypes.splice(0, stateData.selectedFeatAttrTypes.length);
        stateData.selectedFeatOptions.splice(0, stateData.selectedFeatOptions.length);
    }
    state.update({ ...stateData });
}

export let updateDataFilterOrigSettings = function( state, origSettingsVal ) {
    let stateData = { ...state.value };
    stateData.useOrigTempSettings = origSettingsVal;
    if( origSettingsVal ) {
        stateData.selectedSpecType = "";
        stateData.selectedDeviceType = "";
        stateData.selectedTraceCodes.splice(0,stateData.selectedTraceCodes.length);
    }
    state.update({ ...stateData });
};

export let updateQryTypeOrigSettingsCheckbox = function ( data, qryTypeState ) {
    let useOrigFilterQueryType = _.clone(data.useOrigFilterQueryType);
    if (qryTypeState.qryType === "-1" && data.useOrigFilterQueryType.dbValue === false) {
        let stateData = { ...qryTypeState.value };
        stateData.useOrigTempSettings = true;
        stateData.shift = "0";
        stateData.qryType = "0";
        stateData.lastNJobs = "20";
        stateData.lastJobsDays = "";
        stateData.lastJobsHrs = "";
        stateData.lastJobsMins = "";
        stateData.fromDate = "";
        stateData.toDate = "";
        stateData.fromOrSingleJob = "";
        stateData.toJob = "";
        qryTypeState.update({ ...stateData });
        useOrigFilterQueryType.dbValue = true;
    }
    return { useOrigFilterQueryType: useOrigFilterQueryType };
};

export let updateChartType = function( state, chartTypeVal ) {
    let stateData = { ...state.value };
    stateData.chartType = chartTypeVal;
    state.update({ ...stateData });
};

export let updateXAxisLabels = function( state, xAxisLabelsVal ) {
    let stateData = { ...state.value };
    stateData.xAxisLabels = xAxisLabelsVal;
    state.update({ ...stateData });
};

export let updateYAxisLabels = function( state, yAxisLabelsVal ) {
    let stateData = { ...state.value };
    stateData.yAxisLabels = yAxisLabelsVal;
    state.update({ ...stateData });
};

export let updateShift = function( qryTypeState, shiftVal ) {
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.shift = shiftVal;
    qryTypeState.update({ ...qryTypeData });
};

export let updateQueryType = function( qryTypeState, queryTypeVal ) {
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.qryType = queryTypeVal;
    qryTypeState.update({ ...qryTypeData });
};

export let loadTemplateInfo = function ( statFeatureState, dataFilterState ) {
    var deferred = AwPromiseService.instance.defer();
    var repTemplateUid = appCtxSvc.ctx.mselected[0].uid;

    var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/templateInfo/" + repTemplateUid;

    var $http = AwHttpService.instance;
    var postPromise = $http.get(url);
    postPromise.then(function (response) {
        if (response && response.data && response.data.Data) {
            let data = response.data.Data;
            if (data.ReportFilters && data.ReportFilters.length > 0) {
                let repFilter = data.ReportFilters[0];
                let statFeatureStateCopy = _.clone( statFeatureState );
                let dataFilterStateCopy = _.clone( dataFilterState );
                
                _.forEach( repFilter.FeatureAttributes, function( featAttr ) {
                    statFeatureStateCopy.featAttrTypes.push( featAttr );
                } );
                _.forEach( repFilter.SpecCodeNames, function( specCode ) {
                    dataFilterStateCopy.specTypes.push( specCode );
                } );
                _.forEach( repFilter.DeviceTypes, function( deviceType ) {
                    dataFilterStateCopy.deviceTypes.push( deviceType );
                } );
                let traceCodePairs = repFilter.TraceCodePairs;
                var traceCodeMap = {};
                for (var i = 0; i < traceCodePairs.length; i++) {
                    var key = traceCodePairs[i].Key;
                    var value = traceCodePairs[i].Value;

                    if (key in traceCodeMap) {
                        traceCodeMap[key].push(value);
                    } else {
                        traceCodeMap[key] = [value];
                    }
                }
                let routineId = repFilter.RoutineId;
                dataFilterStateCopy.traceCodes = traceCodeMap;
                dataFilterStateCopy.routineId = routineId;
                let updatedStates = { 
                    statFeatureState: statFeatureStateCopy, 
                    dataFilterState: dataFilterStateCopy
                };
                deferred.resolve( updatedStates );
            }
        }
    }, function (err) {
        // error message if the ms call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export let resetTemplateInfo = function ( statFeatureState, dataFilterState ) {
    let statFeatureStateCopy = _.clone( statFeatureState );
    let dataFilterStateCopy = _.clone( dataFilterState );

    statFeatureStateCopy.featAttrTypes.splice(0,statFeatureStateCopy.featAttrTypes.length);
    statFeatureStateCopy.selectedFeatAttrTypes.splice(0,statFeatureStateCopy.selectedFeatAttrTypes.length);
    statFeatureStateCopy.selectedFeatOptions.splice(0,statFeatureStateCopy.selectedFeatOptions.length);
    dataFilterStateCopy.specTypes.splice(0,dataFilterStateCopy.specTypes.length);
    dataFilterStateCopy.deviceTypes.splice(0,dataFilterStateCopy.deviceTypes.length);
    dataFilterStateCopy.traceCodes = {};
    dataFilterStateCopy.routineId = "";
    let updatedStates = { 
        statFeatureState: statFeatureStateCopy, 
        dataFilterState: dataFilterStateCopy
    };
    return updatedStates;
};

export let loadSpecTypesData = function ( dataFilterState ) {
    let specTypesList = [];
    _.forEach( dataFilterState.specTypes, function( specType ) {
        specTypesList.push( {
            "propDisplayValue": specType,
            "propDisplayDescription": "",
            "dispValue": specType,
            "propInternalValue": specType
        } );
    } );
    return { 
        "totalFound": specTypesList.length,
        "specTypesList": specTypesList 
    };
};

export let loadDeviceTypesData = function ( dataFilterState ) {
    var deviceTypesList = [];
    _.forEach( dataFilterState.deviceTypes, function( deviceType ) {
        var deviceTypeDispObj = {
            propDisplayValue: deviceType,
            propDisplayDescription: "",
            dispValue: deviceType,
            propInternalValue: deviceType
        };
        deviceTypesList.push( deviceTypeDispObj );
    } );
    return { 
        "totalFound": deviceTypesList.length,
        "deviceTypesList": deviceTypesList 
    };
};

export let loadTraceCodeData = function ( treeLoadInput, dataFilterState ) {
    var treeLoadResult = {};
    var deferred = AwPromiseService.instance.defer();
    if(treeLoadInput) {
        var treeLoadInputCopy = _.clone(treeLoadInput);
        var parentNode = treeLoadInputCopy.parentNode;
        //treeLoadInput
        var targetNode = parentNode.isExpanded ? parentNode.uid : undefined;
        treeLoadInputCopy.parentElement = targetNode && targetNode.levelNdx > -1 ? targetNode.id : 'AAAAAAAAAAAAAA';
        treeLoadInputCopy.displayMode = 'Tree';
        var displayNodes = [];
        if (treeLoadInputCopy.parentNode.levelNdx === -1) {
            var ind = 1;
            var tempCursorObject = {
                endReached: true,
                startReached: true
            };
            _.forEach(dataFilterState.traceCodes, function (val, key) {
                var treeNodeObj = {
                    id: 'TraceCodeKey' + ind,
                    displayValue: key,
                    type: 'TraceCode'
                };
                var vmNode = awTableService.createViewModelTreeNode(
                    treeNodeObj.id, treeNodeObj.type,
                    treeNodeObj.displayValue, treeLoadInputCopy.parentNode.levelNdx + 1, 0,
                    '');
                vmNode.parentID = treeLoadInputCopy.parentNode.id;
                vmNode.parentName = treeLoadInputCopy.parentNode.displayName;
                vmNode.hierarchy = treeNodeObj.type;
                vmNode.fullName = treeNodeObj.displayValue;
                displayNodes.push(vmNode);
                ind++;
            });
    
            treeLoadResult = awTableService.buildTreeLoadResult(
                treeLoadInputCopy, displayNodes, false, true, true, null);
    
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
        } else {
            var parentNode = treeLoadInputCopy.parentNode;
            var traceCodeVals = dataFilterState.traceCodes[parentNode.displayName];
            var ind = 1;
            _.forEach(traceCodeVals, function (traceCodeVal) {
                var treeNodeObj = {
                    id: parentNode.displayName + 'Val' + ind,
                    displayValue: traceCodeVal,
                    type: 'TraceCode'
                };
                var vmNode = awTableService.createViewModelTreeNode(
                    treeNodeObj.id, treeNodeObj.type,
                    treeNodeObj.displayValue, treeLoadInputCopy.parentNode.levelNdx + 1, 0,
                    '');
                vmNode.isLeaf = true;
                vmNode.parentID = treeLoadInputCopy.parentNode.id;
                vmNode.parentName = treeLoadInputCopy.parentNode.displayName;
                vmNode.hierarchy = treeNodeObj.type;
                vmNode.fullName = treeNodeObj.displayValue;
                displayNodes.push(vmNode);
                ind++;
            });
            treeLoadInputCopy.startChildNdx = 0;
            treeLoadResult = awTableService.buildTreeLoadResult(
                treeLoadInput, displayNodes, false, true, true, null);
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
        }
    }
    deferred.resolve({
        treeLoadResult: treeLoadResult
    });
    return deferred.promise;
};

export let loadTraceCodeTreeProperties = function ( dataProvider ) {
    var viewModelCollection = dataProvider.getViewModelCollection();
    var loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableService.findPropertyLoadInput( arguments );

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if( propertyLoadInput !== null &&
        propertyLoadInput !== undefined &&
        propertyLoadInput !== 'undefined' ) {
        return exports.loadTableProperties( propertyLoadInput, loadedVMOs );
    }
};

/**
 * load Properties required to show in tables'
 * @param {Object} propertyLoadInput - Property Load Input
 * @param {Array} loadedVMOs - Loaded View Model Objects
 * @return {Object} propertyLoadResult
 */
export let loadTableProperties = function( propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            if( childNode.id !== 'top' ) {
                allChildNodes.push( childNode );
            }
        } );
    } );

    var propertyLoadResult = awTableService.createPropertyLoadResult( allChildNodes );

    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};

export let updateSpecType = function( state, specTypeVal ){
    let stateData = { ...state.value };
    stateData.selectedSpecType = specTypeVal;
    state.update({ ...stateData });
};

export let updateDeviceType = function( state, deviceTypeVal ){
    let stateData = { ...state.value };
    stateData.selectedDeviceType = deviceTypeVal;
    state.update({ ...stateData });
};

// Handles selection and de-selection of trace codes in the tree
export let traceCodeSelectionAction = function( selection, dataProvider, dataFilterState ){
    //traceCode should be an array where
    //each tracecode = routineID:traceName:traceValue
    let stateData = { ...dataFilterState.value };

    if ( selection.length > 0 ) {
        // Handles selection when current selection is non-empty
        // clear the selection first 
        stateData.selectedTraceCodes.splice(0,stateData.selectedTraceCodes.length);
        _.forEach(selection, function ( selVal ) {
            if ( selVal.parentName !== 'top' ) {
                var traceCode2Add = dataFilterState.routineId + ":" + selVal.parentName + ":" + selVal.displayName;
                stateData.selectedTraceCodes.push( traceCode2Add );
            }
        });
        dataFilterState.update({ ...stateData });
    } else {
        // Handles de-selection when current selection is empty
        var viewModelCollection = dataProvider.getViewModelCollection();
        var loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
        var len = loadedVMOs.length;
    
        for (var x = 0; x < len; x++) {
            var vmo = loadedVMOs[x];
            if( vmo.parentName !== 'top' && !vmo.selected ) {
                var traceCode2Remove = dataFilterState.routineId+":"+vmo.parentName+":"+vmo.displayName;
                if ( stateData.selectedTraceCodes.includes( traceCode2Remove ) ) {
                    stateData.selectedTraceCodes = stateData.selectedTraceCodes.filter( item => item !== traceCode2Remove );
                    dataFilterState.update({ ...stateData });
                    break;
                }
            }
        }
    }
};

export let resetCommonParams = function ( data, qryTypeState ) {
    let stateData = { ...qryTypeState.value };
    stateData.shift = "0";
    stateData.qryType = "0";
    stateData.lastNJobs = "20";
    stateData.lastJobsDays = "";
    stateData.lastJobsHrs = "";
    stateData.lastJobsMins = "";
    stateData.fromDate = "";
    stateData.toDate = "";
    stateData.fromOrSingleJob = "";
    stateData.toJob = "";
    qryTypeState.update({ ...stateData });

    let queryType = _.clone( data.queryType );
    queryType.dbValue = qryTypeState.qryType;
    const dpvTextBundle = _localeSvc.getLoadedText( 'DpvMessages' );
    queryType.uiValue = dpvTextBundle["LastNumberOfJobs"];
    let shift = _.clone( data.shift );
    shift.dbValue = qryTypeState.shift;
    let lastNJobs = _.clone( data.lastNJobs );
    lastNJobs.dbValue = qryTypeState.lastNJobs;
    lastNJobs.uiValue = qryTypeState.lastNJobs;
    let days = _.clone( data.days );
    days.dbValue = qryTypeState.lastJobsDays;
    days.uiValue = qryTypeState.lastJobsDays;
    let hours = _.clone( data.hours );
    hours.dbValue = qryTypeState.lastJobsHrs;
    hours.uiValue = qryTypeState.lastJobsHrs;
    let minutes = _.clone( data.minutes );
    minutes.dbValue = qryTypeState.lastJobsMins;
    minutes.uiValue = qryTypeState.lastJobsMins;
    let fromDate = _.clone( data.fromDate );
    fromDate.dbValue = qryTypeState.fromDate;
    fromDate.uiValue = qryTypeState.fromDate;
    let toDate = _.clone( data.toDate );
    toDate.dbValue = qryTypeState.toDate;
    toDate.uiValue = qryTypeState.toDate;
    let fromJob = _.clone( data.fromJob );
    fromJob.dbValue = qryTypeState.fromOrSingleJob;
    fromJob.uiValue = qryTypeState.fromOrSingleJob;
    let toJob = _.clone( data.toJob );
    toJob.dbValue = qryTypeState.toJob;
    toJob.uiValue = qryTypeState.toJob;
    
    let queryTypeList = _.clone( data.queryTypeList );
    for( var idx = 0; idx < queryTypeList.dbValue.length; idx++ ) {
        queryTypeList.dbValue[idx].selected = queryTypeList.dbValue[idx].propInternalValue === qryTypeState.qryType ? true : false;
        queryTypeList.dbValues[idx].selected = queryTypeList.dbValues[idx].propInternalValue === qryTypeState.qryType ? true : false;
    }

    return {
        "queryType": queryType,
        "queryTypeList": queryType,
        "shift": shift,
        "lastNJobs": lastNJobs,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "fromDate": fromDate,
        "toDate": toDate,
        "fromJob": fromJob,
        "toJob": toJob
    };
};

export let resetChartSettingsData = function ( data, chartSettingsState ) {
    let chartType = _.clone( data.chartType );
    chartType.dbValue = chartSettingsState.chartType;
    let xAxisLabels = _.clone( data.xAxisLabels );
    xAxisLabels.dbValue = chartSettingsState.xAxisLabels;
    let yAxisLabels = _.clone( data.yAxisLabels );
    yAxisLabels.dbValue = chartSettingsState.yAxisLabels;
    let annotationColorCheckbox = _.clone( data.annotationColorCheckbox );
    annotationColorCheckbox.dbValue = chartSettingsState.annotationColorBox;
    let annotationGreen = _.clone( data.annotationGreen );
    annotationGreen.dbValue = chartSettingsState.annotationGreen;
    let annotationRed = _.clone( data.annotationRed );
    annotationRed.dbValue = chartSettingsState.annotationRed;
    let basis = _.clone( data.basis );
    basis.dbValue = chartSettingsState.basis;
    basis.uiValue = "ppk";
    
    let basisList = _.clone( data.basisList );
    for( var idx = 0; idx < basisList.dbValue.length; idx++ ) {
        basisList.dbValue[idx].selected = basisList.dbValue[idx].propInternalValue === chartSettingsState.basis ? true : false;
        basisList.dbValues[idx].selected = basisList.dbValues[idx].propInternalValue === chartSettingsState.basis ? true : false;
    }
    
    let barChartScopeGreen = _.clone( data.barChartScopeGreen );
    barChartScopeGreen.dbValue = chartSettingsState.barChartScopeGreen;
    let barChartScopeRed = _.clone( data.barChartScopeRed );
    barChartScopeRed.dbValue = chartSettingsState.barChartScopeRed;
    let barChartScopeBlack = _.clone( data.barChartScopeBlack );
    barChartScopeBlack.dbValue = chartSettingsState.barChartScopeBlack;

    let useOrigSettingCheckbox = _.clone( data.useOrigSettingCheckbox );

    if( chartSettingsState.useOrigTempSettings ) {
        useOrigSettingCheckbox.dbValue = true;
    }

    return {
        "useOrigSettingCheckbox": useOrigSettingCheckbox,
        "chartType": chartType,
        "xAxisLabels": xAxisLabels,
        "yAxisLabels": yAxisLabels,
        "annotationColorCheckbox": annotationColorCheckbox,
        "annotationGreen": annotationGreen,
        "annotationRed": annotationRed,
        "basis": basis,
        "basisList": basisList,
        "barChartScopeGreen": barChartScopeGreen,
        "barChartScopeRed": barChartScopeRed,
        "barChartScopeBlack": barChartScopeBlack
    };
};

export let resetDataFilterData = function ( data, traceCodeDataProvider, dataFilterState  ) {
    traceCodeDataProvider.selectNone();
    traceCodeDataProvider.resetDataProvider();

    let stateData = { ...dataFilterState.value };
    stateData.selectedDeviceType = "";
    stateData.selectedSpecType = "";
    stateData.selectedTraceCodes.splice( 0,stateData.selectedTraceCodes.length );
    dataFilterState.update({ ...stateData });
    
    let specType = _.clone( data.specType );
    specType.dbValue = dataFilterState.selectedSpecType;
    specType.uiValue = dataFilterState.selectedSpecType;
    let deviceType = _.clone( data.deviceType );
    deviceType.dbValue = dataFilterState.selectedDeviceType;
    deviceType.uiValue = dataFilterState.selectedDeviceType;

    let useOrigSettingCheckbox = _.clone( data.useOrigSettingCheckbox );

    if( dataFilterState.useOrigTempSettings ) {
        useOrigSettingCheckbox.dbValue = true;
    }

    return {
        "useOrigSettingCheckbox": useOrigSettingCheckbox,
        "specType": specType,
        "deviceType": deviceType
    };
};

export let updateOrigSettingCheckBox = function ( useOrigSettingCheckbox, state ) {
    let origSettingsChkBox = _.clone( useOrigSettingCheckbox );
    if( state.useOrigTempSettings ) {
        origSettingsChkBox.dbValue = true;
    }
    return {
        "useOrigSettingCheckbox": origSettingsChkBox
    };
};       

export default exports = {
    updateLastNJobs,
    updateDaysJob,
    updateHrsJob,
    updateMinsJob,
    updateFromDate,
    updateToDate,
    updateFromJob,
    updateToJob,
    updateYAxisToSpecLimit,
    updateYAxisFromUserDefined,
    updateYAxisToUserDefined,
    updateUserDefinedOption,
    updateIncludeZero,
    updateAnnotationColorBox,
    updateAnnotationRed,
    updateAnnotationGreen,
    updateBarChartScopeGreen,
    updateBarChartScopeRed,
    updateBarChartScopeBlack,
    updateBasisAndAnnColors,
    loadStatAttributesColumn,
    selectStatFeature,
    loadFeatureAttrTypes,
    loadFeatureOptions,
    updateFeatAttrTypeList,
    updateFeatOptionsList,
    generateReport,
    updateQueryTypeOrigSettings,
    updateChartOrigSettings,
    updateStatFeatAttrOrigSettings,
    updateStatFeatOrigSettings,
    updateDataFilterOrigSettings,
    updateQryTypeOrigSettingsCheckbox,
    updateChartType,
    updateXAxisLabels,
    updateYAxisLabels,
    updateShift,
    updateQueryType,
    loadTemplateInfo,
    resetTemplateInfo,
    loadSpecTypesData,
    loadDeviceTypesData,
    loadTraceCodeData,
    loadTraceCodeTreeProperties,
    loadTableProperties,
    updateSpecType,
    updateDeviceType,
    traceCodeSelectionAction,
    resetCommonParams,
    resetChartSettingsData,
    resetDataFilterData,
    updateOrigSettingCheckBox
};
