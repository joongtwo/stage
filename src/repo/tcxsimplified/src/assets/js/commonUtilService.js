// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle common utility method execution only.
 *
 * @module js/commonUtilService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import _ from 'lodash';

var exports = {};
var m_attachmentTypes = [];

export let getAttachedTargetObjects = function() {
    var targetObjects = [];
    m_attachmentTypes = [];

    var selection = selectionService.getSelection();
    var selectedObjs = selection.selected;

    _.forEach( selectedObjs, function( selectedObj ) {
        targetObjects.push( selectedObj.props.awb0UnderlyingObject.dbValues[0] );
        m_attachmentTypes.push( 1 ); //EPM_target_attachment
    } );

    return targetObjects;
};

export let getTargetAttachmentTypes = function() {
    return m_attachmentTypes;
};

export let setHeaderTitle = function() {
    var valueLocal;
    var localTextBundle = localeService.getLoadedText( 'tcxsimplifiedMessages' );
    if ( appCtxService.ctx.preferences.TcXLite_mode ) {
        valueLocal = localTextBundle.tcXSimplifiedLandingPage;
    } else {
        valueLocal = localTextBundle.tcXSimplifiedLandingPageforPremInstall;
    }
    return valueLocal;
};

export let getReleasedInfo = function( data ) {
    var selection = selectionService.getSelection();
    var selectedObjs = selection.selected;
    data.releasedCount = 0;
    data.releasedObjects = [];

    _.forEach( selectedObjs, function( selectedObj ) {
        if ( selectedObj.props.awb0ArchetypeRevRelStatus.dbValues.length > 0 ) {
            data.releasedCount++;
            var releasedObject = {
                name: ''
            };
            releasedObject.name = selectedObj.props.awb0UnderlyingObject.uiValues[0];
            data.releasedObjects.push( releasedObject );
        }
    } );
};


export default exports = {
    getAttachedTargetObjects,
    getTargetAttachmentTypes,
    getReleasedInfo,
    setHeaderTitle
};

