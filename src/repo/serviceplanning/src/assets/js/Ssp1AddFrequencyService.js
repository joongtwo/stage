// Copyright (c) 2022 Siemens

/**
 * Service Plan functions
 *
 * @module js/Ssp1AddFrequencyService
 */
 
 import _ from 'lodash';

 var exports = {};
 var exprId = 0;
 
 export let getRelatedObject = function( selectedVMO ) {
     let map = new Map();
     let VMOuid = selectedVMO.uid;
     let VMOtype = selectedVMO.type;
     map[String( VMOuid )] = { uid:VMOuid, type:VMOtype };
     return map;
 };
 
 export let getNameToValuesMap = function(data)
 {
     let nameValueMap = {};
     nameValueMap.object_name = [data.frequencyName.dbValue];
     if(data.frequencyDesc.dbValue !== ""){
         nameValueMap.object_desc = [data.frequencyDesc.dbValue];
     }
     if(data.frequencyId.dbValue !== ""){
         nameValueMap.item_id = [data.frequencyId.dbValue];
     }
     return nameValueMap;
 };
 
 export let getFinalExpression = function( savedExpressionsList ) {
     let expression = "";
     var expressionList = savedExpressionsList;
     expressionList.forEach(function (expr) {
         expression = expression + expr.cellHeader1 + " ";
     });
     return expression;
 };
 
 export let saveFrequency = function( data ) {
     let expression = "";
     if(data.phraseSeperator.dbValue !== "" ){
         expression = data.phraseSeperator.dbValue + " ";
     }
     if(data.keywords.dbValue !== "" && data.frequencyValue.dbValue === "" && ( data.frequencyCharacteristics.dbValue === "Manufacture Date" || data.frequencyCharacteristics.dbValue === "Install Date")){
         expression = expression + data.keywords.dbValue + " " + data.frequencyCharacteristics.dbValue;
     }
     if(data.keywords.dbValue !== "" && data.frequencyValue.dbValue !== "" && data.frequencyCharacteristics.dbValue !== ""){
         expression = expression + data.keywords.dbValue + " " + data.frequencyValue.dbValue + " " + data.frequencyCharacteristics.dbValue;
     }
     if(data.keywords.dbValue !== "" && data.frequencyValue.dbValue === "" && data.characteristicType === 'Observation' && data.frequencyOperators.dbValue !== "" && data.operatorsValue.dbValue !== ""){
         expression = expression + data.keywords.dbValue + " " + data.frequencyCharacteristics.dbValue + " " + data.frequencyOperators.dbValue + " " + data.operatorsValue.dbValue;
     }
     if(data.keywords.dbValue !== "" && data.frequencyValue.dbValue === "" && data.characteristicType === 'Date' && data.frequencyDateTime.uiValue !== ""){
         expression = expression + data.keywords.dbValue + " " + data.frequencyCharacteristics.dbValue + " " + getDate(data.frequencyDateTime.dbValue);
     }
     if(data.toleranceSign.dbValue !== "" && data.toleranceValue.dbValue !== ""){
         expression = expression + " " + data.toleranceSign.dbValue + " " + data.toleranceValue.dbValue;
         if(data.toleranceType.dbValue !== ""){
             expression = expression + " " + data.toleranceType.dbValue;
         }
     }
     if(data.afterUntil.dbValue !== "" && data.afterUntilValue.dbValue === "" && ( data.afterUntilCharacteristic.dbValue === "Manufacture Date" || data.afterUntilCharacteristic.dbValue === "Install Date")){
         expression = expression + " " + data.afterUntil.dbValue + " " + data.afterUntilCharacteristic.dbValue;
     }
     if(data.afterUntil.dbValue !== "" && data.afterUntilValue.dbValue !== "" && data.afterUntilCharacteristic.dbValue !== ""){
         expression = expression + " " + data.afterUntil.dbValue + " " + data.afterUntilValue.dbValue + " " + data.afterUntilCharacteristic.dbValue;
     }
     if(data.afterUntil.dbValue !== "" && data.afterUntilValue.dbValue === "" && data.characteristicTypeAdvanced === 'Observation' && data.advancedOperators.dbValue !== ""  && data.advancedOperatorsValue.dbValue !== "" ){
         expression = expression + " " + data.afterUntil.dbValue + " " + data.afterUntilCharacteristic.dbValue + " " + data.advancedOperators.dbValue + " " + data.advancedOperatorsValue.dbValue;
     }
     if(data.afterUntil.dbValue !== "" && data.afterUntilValue.dbValue === "" && data.characteristicTypeAdvanced === 'Date' && data.advancedDateTime.uiValue !== ""){
         expression = expression + " " + data.afterUntil.dbValue + " " + data.afterUntilCharacteristic.dbValue + " " + getDate(data.advancedDateTime.dbValue);
     }
     if(data.savedExpressionsList){
         var outputVals = data.savedExpressionsList;
     }
     else{
         var outputVals = [];
     }
 
     exprId = exprId + 1;
     var uid = exprId;
     
     if(expression.length > 9){
         outputVals.push({
                 Title: uid,
                 cellHeader1: expression
             });
     }
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 let getDate = function( time ){
     const newdate = new Date(time);
     return newdate.toLocaleDateString('en-ZA');
 };
 
 export let removeFreqExpression = function( savedExpressionsList, exprId ) {
 
     var outputVals = savedExpressionsList;
 
     var objectUidToRemove = exprId;
 
     outputVals = outputVals.filter(function( obj ) {
         return obj.Title !== objectUidToRemove;
     });
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let moveUpFreqExpression = function( savedExpressionsList, exprId ) {
 
     var outputVals = savedExpressionsList;
 
     var objectUidToMoveUp = exprId;
     
     var fromIndex = outputVals.findIndex(obj => obj.Title === objectUidToMoveUp);
     var toIndex = fromIndex-1;
 
     var element = outputVals[fromIndex];
 
     outputVals.splice(fromIndex, 1);
     outputVals.splice(toIndex, 0, element);
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let moveDownFreqExpression = function( savedExpressionsList, exprId ) {
 
     var outputVals = savedExpressionsList;
 
     var objectUidToMoveDown = exprId;
     
     var fromIndex = outputVals.findIndex(obj => obj.Title === objectUidToMoveDown);
     var toIndex = fromIndex+1;
 
     var element = outputVals[fromIndex];
     outputVals.splice(fromIndex, 1);
     outputVals.splice(toIndex, 0, element);
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let getBvrPartRevisionUid = function( selectedVMO ) {
     let objects = selectedVMO.props.Mfg0all_material.dbValues;
     let input = [];
     objects.forEach( o => input.push( {
         uid: o
     } ) );
     return input;
 };
 
 export let setPartRevision = function( response ) {
     let partRevList = [];
     if ( response.modelObjects !== undefined ) {
         const modelObjects = response.modelObjects || response.data.modelObjects;
         Object.values( modelObjects ).filter( modelObject => modelObject.modelType.typeHierarchyArray.includes("ItemRevision")).forEach(
             modelObject => partRevList.push({
                 uid: modelObject.uid
             }));
     }
     return partRevList;
 };
 
 export let setPartUids = function( response, topPartUid ) {
     let partRevList = [];
     if ( response.modelObjects !== undefined ) {
         const modelObjects = response.modelObjects || response.data.modelObjects;
         Object.values( modelObjects ).filter( modelObject => modelObject.modelType.typeHierarchyArray.includes("Item")).forEach(
             modelObject => partRevList.push({
                 uid: modelObject.uid
             }));
     }
     if(partRevList.length === 0){
         partRevList.push({
             uid: topPartUid
         });
     }
     return partRevList;
 };
 
 export let populateCharacteristicsLists = function( characteristicsList ) {
     var list = characteristicsList;
     var lifeCharacteristicList = [];
     var observationCharacteristicList = [];
     var dateCharacteristicList = [];
     var characteristicsLists = {};
     for( var i in list ) {
         if( list[i].modelType.typeHierarchyArray.includes("ObsCharDefinition")) {
             observationCharacteristicList.push( list[i].props.object_name.dbValues[0] );
         }
         else if( list[i].modelType.typeHierarchyArray.includes("LifeCharDefinition" )) {
             lifeCharacteristicList.push( list[i].props.object_name.dbValues[0] );
         }
         else if( list[i].modelType.typeHierarchyArray.includes("DateCharDefinition")) {
             dateCharacteristicList.push( list[i].props.object_name.dbValues[0] );
         }
     }
     characteristicsLists.lifeCharacteristicList = lifeCharacteristicList;
     characteristicsLists.observationCharacteristicList = observationCharacteristicList;
     characteristicsLists.dateCharacteristicList = dateCharacteristicList;
     return characteristicsLists;
 };
 
 export let searchCharacteristicsAfterUntil = function( data ) {
     var outputVals = [];
     var lifeCharList = data.lifeCharacteristicList;
     var obsCharList = data.observationCharacteristicList;
     var dateCharList = data.dateCharacteristicList;
 
     if( data.afterUntil.dbValues[0] && data.afterUntil.dbValues[0] !== '' ) {
         outputVals = [
             { propDisplayValue: '', propInternalValue: '' },
             { propDisplayValue: 'Days', propInternalValue: 'Days' },
             { propDisplayValue: 'Months', propInternalValue: 'Months' },
             { propDisplayValue: 'Years', propInternalValue: 'Years' },
             { propDisplayValue: 'Calendar', propInternalValue: 'Calendar' }
         ];
         if( data.afterUntil.dbValues[0] === 'After' ) {
             var concatVals = [
                 { propDisplayValue: 'Install Date', propInternalValue: 'Install Date' },
                 { propDisplayValue: 'Manufacture Date', propInternalValue: 'Manufacture Date' }
             ];
             outputVals = outputVals.concat( concatVals );
             if(obsCharList){
                 obsCharList.forEach( obsChar => outputVals.push( {
                     propDisplayValue: obsChar,
                     propInternalValue: obsChar
                 } ) );
             }
         }
         if(lifeCharList){
             lifeCharList.forEach( lifeChar => outputVals.push( {
                 propDisplayValue: lifeChar,
                 propInternalValue: lifeChar
             } ) );
         }
         if(dateCharList){
             dateCharList.forEach( dateChar => outputVals.push( {
                 propDisplayValue: dateChar,
                 propInternalValue: dateChar
             } ) );
         }
     }
     return outputVals;
 };
 
 export let searchCharacteristicsKeyword = function( data ) {
     var outputVals = [];
     var lifeCharList = data.lifeCharacteristicList;
     var dateCharList = data.dateCharacteristicList;
     var obsCharList = data.observationCharacteristicList;
     if( data.keywords.dbValues[0] && data.keywords.dbValues[0] !== '' ) {
         outputVals = [
             { propDisplayValue: '', propInternalValue: '' }
         ];
         if( data.keywords.dbValues[0] === 'At' ) {
             var concatVals = [
                 { propDisplayValue: 'Calendar', propInternalValue: 'Calendar' },
                 { propDisplayValue: 'Days', propInternalValue: 'Days' },
                 { propDisplayValue: 'Months', propInternalValue: 'Months' },
                 { propDisplayValue: 'Years', propInternalValue: 'Years' },
                 { propDisplayValue: 'Install Date', propInternalValue: 'Install Date' },
                 { propDisplayValue: 'Manufacture Date', propInternalValue: 'Manufacture Date' }
             ];
             outputVals = outputVals.concat( concatVals );
             if(lifeCharList){
                 lifeCharList.forEach( lifeChar => outputVals.push( {
                     propDisplayValue: lifeChar,
                     propInternalValue: lifeChar
                 } ) );
             }
             if(dateCharList){
                 dateCharList.forEach( dateChar => outputVals.push( {
                     propDisplayValue: dateChar,
                     propInternalValue: dateChar
                 } ) );
             }
         }
         else if( data.keywords.dbValues[0] === 'Every' ) {
             var concatVals = [
                 { propDisplayValue: 'Days', propInternalValue: 'Days' },
                 { propDisplayValue: 'Months', propInternalValue: 'Months' },
                 { propDisplayValue: 'Years', propInternalValue: 'Years' }
             ];
             outputVals = outputVals.concat( concatVals );
             if(lifeCharList){
                 lifeCharList.forEach( lifeChar => outputVals.push( {
                     propDisplayValue: lifeChar,
                     propInternalValue: lifeChar
                 } ) );
             }
         }
         else if( data.keywords.dbValues[0] === 'Within' ) {
             if(lifeCharList){
                 lifeCharList.forEach( lifeChar => outputVals.push( {
                     propDisplayValue: lifeChar,
                     propInternalValue: lifeChar
                 } ) );
             }
         }
         else if( data.keywords.dbValues[0] === 'When' ) {
             if(obsCharList){
                 obsCharList.forEach( obsChar => outputVals.push( {
                     propDisplayValue: obsChar,
                     propInternalValue: obsChar
                 } ) );
             }
         }
         
     }
     return outputVals;
 };
 
 export let groupFrequencies = function( savedExpressionsList, selectedExprObjects ) {
 
     var outputVals = savedExpressionsList;
 
     var selectedObjects = selectedExprObjects;
     
     var startObjectIndex = outputVals.findIndex(obj => obj.Title === selectedObjects[0].Title);
     var endObjectIndex = outputVals.findIndex(obj => obj.Title === selectedObjects[selectedObjects.length - 1].Title);
 
     var firstString = outputVals[startObjectIndex].cellHeader1;
     const first = firstString.split(' ')[0];
 
     if (first === "And" || first === "Then" || first === "Or"){
         var firstString = outputVals[startObjectIndex].cellHeader1;
         outputVals[startObjectIndex].cellHeader1 = [firstString.slice(0, first.length), " (", firstString.slice(first.length)].join('');
     }
     else{
         outputVals[startObjectIndex].cellHeader1 = "( " + outputVals[startObjectIndex].cellHeader1;
     }
 
     outputVals[endObjectIndex].cellHeader1 = outputVals[endObjectIndex].cellHeader1 + " )";
 
     outputVals.unshift({
         Title: 999,
         cellHeader1: ""
     });
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let ungroupFrequencies = function( savedExpressionsList, selectedExprObjects ) {
     var outputVals = savedExpressionsList;
 
     var selectedObjects = selectedExprObjects;
     
     var startObjectIndex = outputVals.findIndex(obj => obj.Title === selectedObjects[0].Title);
     var endObjectIndex = outputVals.findIndex(obj => obj.Title === selectedObjects[selectedObjects.length - 1].Title);
 
     var firstString = outputVals[startObjectIndex].cellHeader1;
     var endString = outputVals[endObjectIndex].cellHeader1;
     const first = firstString.split(' ')[0];
     const second = firstString.split(' ')[1];
     const end = endString[endString.length-1];
 
     if((first === "(" || second === "(") && end ===")")
     {
         if (first === "And" || first === "Then" || first === "Or"){
             outputVals[startObjectIndex].cellHeader1 = [firstString.slice(0, first.length), firstString.slice(first.length + 2)].join('');
         }
         else{
             outputVals[startObjectIndex].cellHeader1 = outputVals[startObjectIndex].cellHeader1.slice(2);
         }
 
         outputVals[endObjectIndex].cellHeader1 = outputVals[endObjectIndex].cellHeader1.slice(0, outputVals[endObjectIndex].cellHeader1.length - 2);
     }
     
     outputVals.unshift({
         Title: 999,
         cellHeader1: ""
     });
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let refreshFrequencyList = function( savedExpressionsList ) {
     var outputVals = savedExpressionsList;
     outputVals.shift();
 
     return {
         savedExpressionsList : outputVals,
         savedExpressionsCount : outputVals.length
     };
 };
 
 export let resetFrequencyFields = function( data ) {
     var tempData = _.clone( data );
     tempData.phraseSeperator.dbValue = "";
     tempData.phraseSeperator.uiValue = "";
     tempData.phraseSeperator.dbOriginalValue = "";
 
     var retData = resetFieldsOnChangePhaseSeperator(tempData);
 
     return {
         phraseSeperator: tempData.phraseSeperator,
         keywords: retData.keywords,
         frequencyCharacteristics: retData.frequencyCharacteristics,
         frequencyValue: retData.frequencyValue,
         afterUntil: retData.afterUntil,
         toleranceSign: retData.toleranceSign,
         toleranceValue: retData.toleranceValue,
         toleranceType: retData.toleranceType,
         afterUntilCharacteristic: retData.afterUntilCharacteristic,
         afterUntilValue: retData.afterUntilValue,
         characteristicType: retData.chartype,
         characteristicTypeAdvanced: retData.characteristicTypeAdvanced,
         frequencyOperators: tempData.frequencyOperators,
         operatorsValue: tempData.operatorsValue,
         advancedOperators: retData.advancedOperators,
         advancedOperatorsValue: retData.advancedOperatorsValue,
         frequencyDateTime: tempData.frequencyDateTime,
         advancedDateTime: retData.advancedDateTime
     };
 };
 
 export let resetFieldsOnChangePhaseSeperator = function( data ) {
     var tempData = _.clone( data );
     tempData.keywords.dbValue = "";
     tempData.keywords.dbOriginalValue = "";
     tempData.keywords.uiValue = "";
 
     var retData = resetFieldsOnChangeKeywords(tempData);
 
     return {
         keywords: tempData.keywords,
         frequencyCharacteristics: retData.frequencyCharacteristics,
         frequencyValue: retData.frequencyValue,
         afterUntil: retData.afterUntil,
         toleranceSign: retData.toleranceSign,
         toleranceValue: retData.toleranceValue,
         toleranceType: retData.toleranceType,
         afterUntilCharacteristic: retData.afterUntilCharacteristic,
         afterUntilValue: retData.afterUntilValue,
         characteristicType: retData.chartype,
         characteristicTypeAdvanced: retData.characteristicTypeAdvanced,
         frequencyOperators: tempData.frequencyOperators,
         operatorsValue: tempData.operatorsValue,
         advancedOperators: retData.advancedOperators,
         advancedOperatorsValue: retData.advancedOperatorsValue,
         frequencyDateTime: tempData.frequencyDateTime,
         advancedDateTime: retData.advancedDateTime
     };
 };
 
 export let resetFieldsOnChangeKeywords = function( data ) {
     var tempData = _.clone( data );
     tempData.frequencyCharacteristics.dbValue = "";
     tempData.frequencyCharacteristics.dbOriginalValue = "";
     tempData.frequencyCharacteristics.uiValue = "";
 
     tempData.frequencyValue.dbValue = "";
     tempData.frequencyValue.uiValue = "";
 
     var retData = resetFieldsOnChangeCharacteristics(tempData);
 
     return {
         frequencyCharacteristics: tempData.frequencyCharacteristics,
         frequencyValue: tempData.frequencyValue,
         afterUntil: retData.afterUntil,
         toleranceSign: retData.toleranceSign,
         toleranceValue: retData.toleranceValue,
         toleranceType: retData.toleranceType,
         afterUntilCharacteristic: retData.afterUntilCharacteristic,
         afterUntilValue: retData.afterUntilValue,
         characteristicType: retData.chartype,
         characteristicTypeAdvanced: retData.characteristicTypeAdvanced,
         frequencyOperators: tempData.frequencyOperators,
         operatorsValue: tempData.operatorsValue,
         advancedOperators: retData.advancedOperators,
         advancedOperatorsValue: retData.advancedOperatorsValue,
         frequencyDateTime: tempData.frequencyDateTime,
         advancedDateTime: retData.advancedDateTime
     };
 };
 
 export let resetFieldsOnChangeCharacteristics = function( data ) {
     var tempData = _.clone( data );
     var chartype = "";
     var obsCharList = data.observationCharacteristicList;
     var dateCharList = data.dateCharacteristicList;
 
     if(obsCharList.includes(tempData.frequencyCharacteristics.dbValue)){
         chartype = "Observation";
     }
     else if(dateCharList.includes(tempData.frequencyCharacteristics.dbValue) || tempData.frequencyCharacteristics.dbValue === "Calendar"){
         chartype = "Date";
     }
     else{
         chartype = "";
     }
 
     if(tempData.frequencyCharacteristics.dbValue === 'Manufacture Date' || tempData.frequencyCharacteristics.dbValue === 'Install Date' || chartype !== ''){
         tempData.frequencyValue.dbValue = "";
         tempData.frequencyValue.uiValue = "";
     }
 
     tempData.afterUntil.dbValue = "";
     tempData.afterUntil.dbOriginalValue = "";
     tempData.afterUntil.uiValue = "";
 
     tempData.toleranceSign.dbValue = "";
     tempData.toleranceSign.dbOriginalValue = "";
     tempData.toleranceSign.uiValue = "";
 
     tempData.toleranceValue.dbValue = "";
     tempData.toleranceValue.uiValue = "";
 
     tempData.toleranceType.dbValue = "";
     tempData.toleranceType.dbOriginalValue = "";
     tempData.toleranceType.uiValue = "";
     
     tempData.frequencyOperators.dbValue = "";
     tempData.frequencyOperators.dbOriginalValue = "";
     tempData.frequencyOperators.uiValue = "";
 
     tempData.operatorsValue.dbValue = "";
     tempData.operatorsValue.uiValue = "";
 
     tempData.frequencyDateTime.dbValue = "";
     tempData.frequencyDateTime.uiValue = "";
     tempData.frequencyDateTime.displayValues[0] = "";
 
     var retData = resetFieldsOnChangeAfterUntil(tempData);
 
     return {
         frequencyValue: tempData.frequencyValue,
         afterUntil: tempData.afterUntil,
         toleranceSign: tempData.toleranceSign,
         toleranceValue: tempData.toleranceValue,
         toleranceType: tempData.toleranceType,
         afterUntilCharacteristic: retData.afterUntilCharacteristic,
         afterUntilValue: retData.afterUntilValue,
         characteristicType: chartype,
         characteristicTypeAdvanced: retData.characteristicTypeAdvanced,
         frequencyOperators: tempData.frequencyOperators,
         operatorsValue: tempData.operatorsValue,
         advancedOperators: retData.advancedOperators,
         advancedOperatorsValue: retData.advancedOperatorsValue,
         frequencyDateTime: tempData.frequencyDateTime,
         advancedDateTime: retData.advancedDateTime
     };
 };
 
 export let resetFieldsOnChangeAfterUntil = function( data ) {
     var tempData = _.clone( data );
     var chartypeAdvanced = "";
 
     tempData.afterUntilCharacteristic.dbValue = "";
     tempData.afterUntilCharacteristic.dbOriginalValue = "";
     tempData.afterUntilCharacteristic.uiValue = "";
 
     tempData.afterUntilValue.dbValue = "";
     tempData.afterUntilValue.uiValue = "";
 
     tempData.advancedOperators.dbValue = "";
     tempData.advancedOperators.dbOriginalValue = "";
     tempData.advancedOperators.uiValue = "";
 
     tempData.advancedOperatorsValue.dbValue = "";
     tempData.advancedOperatorsValue.uiValue = "";
 
     tempData.advancedDateTime.dbValue = "";
     tempData.advancedDateTime.uiValue = "";
     tempData.advancedDateTime.displayValues[0] = "";
 
     return {
         afterUntilCharacteristic: tempData.afterUntilCharacteristic,
         afterUntilValue: tempData.afterUntilValue,
         characteristicTypeAdvanced: chartypeAdvanced,
         advancedOperators: tempData.advancedOperators,
         advancedOperatorsValue: tempData.advancedOperatorsValue,
         advancedDateTime: tempData.advancedDateTime
     };
 };
 
 export let resetFieldsOnChangeAdvancedCharacteristics = function( data ) {
     var tempData = _.clone( data );
     var chartypeAdvanced = "";
     var obsCharList = data.observationCharacteristicList;
     var dateCharList = data.dateCharacteristicList;
 
     if(obsCharList.includes(tempData.afterUntilCharacteristic.dbValue)){
         chartypeAdvanced = "Observation";
     }
     else if(dateCharList.includes(tempData.afterUntilCharacteristic.dbValue) || tempData.afterUntilCharacteristic.dbValue === "Calendar"){
         chartypeAdvanced = "Date";
     }
     else{
         chartypeAdvanced = "";
     }
 
     if(tempData.afterUntilCharacteristic.dbValue === 'Manufacture Date' || tempData.afterUntilCharacteristic.dbValue === 'Install Date' || chartypeAdvanced !== ''){
         tempData.afterUntilValue.dbValue = "";
         tempData.afterUntilValue.uiValue = "";
     }
 
     tempData.advancedOperators.dbValue = "";
     tempData.advancedOperators.dbOriginalValue = "";
     tempData.advancedOperators.uiValue = "";
 
     tempData.advancedOperatorsValue.dbValue = "";
     tempData.advancedOperatorsValue.uiValue = "";
 
     tempData.advancedDateTime.dbValue = "";
     tempData.advancedDateTime.uiValue = "";
     tempData.advancedDateTime.displayValues[0] = "";
 
     return {
         afterUntilValue: tempData.afterUntilValue,
         characteristicTypeAdvanced: chartypeAdvanced,
         advancedOperators: tempData.advancedOperators,
         advancedOperatorsValue: tempData.advancedOperatorsValue,
         advancedDateTime: tempData.advancedDateTime
     };
 };
 
 export default exports = {
     getRelatedObject,
     getFinalExpression,
     getBvrPartRevisionUid,
     setPartRevision,
     setPartUids,
     populateCharacteristicsLists,
     searchCharacteristicsAfterUntil,
     searchCharacteristicsKeyword,
     saveFrequency,
     removeFreqExpression,
     moveUpFreqExpression,
     moveDownFreqExpression,
     groupFrequencies,
     ungroupFrequencies,
     refreshFrequencyList,
     resetFrequencyFields,
     resetFieldsOnChangePhaseSeperator,
     resetFieldsOnChangeKeywords,
     resetFieldsOnChangeCharacteristics,
     resetFieldsOnChangeAdvancedCharacteristics,
     resetFieldsOnChangeAfterUntil,
     getNameToValuesMap
 };
 