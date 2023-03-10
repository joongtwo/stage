// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphTemplateService
 */
import graphTemplateService from 'js/graphTemplateService';
import _ from 'lodash';
import logger from 'js/logger';
import graphStyleUtils from 'js/graphStyleUtils';
import awIconSvc from 'js/awIconService';
import { svgString as cmdChild } from 'image/cmdChild24.svg';

var exports = {};

var PROPERTY_NAME = 'awp0CellProperties';
var THUMBNAIL_URL = 'thumbnail_image';
var TEMPLATE_ID_DELIMITER = '-';
var TEMPLATE_VALUE_CONN_CHAR = '\\:';

var NODE_TEMPLATE_NAME = 'MrmResourceTileNodeTemplate';
var GROUP_NODE_TEMPLATE_NAME = 'MrmResourceGroupTileNodeTemplate';

/**
 * Binding class name for node
 */
export let NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';

/**
 * Binding class name for text inside the tile
 */
export let TEXT_HOVERED_CLASS = 'relation_TEXT_hovered_style_svg';

/**
 * Binding the color bar width for node
 */
var COLOR_BAR_WIDTH = 'barWidth';

/**
 * Binding whether this is the root node.
 */
var IS_ROOT = 'is_root';

/**
 * Binding Class Name for root node border style
 */
var ROOTNODE_BORDER_STYLE = 'rootnode_border_style';

/**
 * The interpolate delimiter used in node SVG template
 */
var _nodeTemplateInterpolate = {
    interpolate: /<%=([\s\S]+?)%>/g
};

/**
 * Determine whether to use multiple level node template
 *
 * @param {Object} nodeObject the model object of node
 * @return true if need use multiple level template, false otherwise
 */
export let useMultiLevelTemplate = function( nodeObject ) {
    return false;
};

/**
 * Construct node SVG template from a base template by interpolate the binding properties into the property binding
 * placeholder. The constant interpolate placeholder <%=PROPERTY_LIST%> is especially supported to bind a list of
 * properties.
 *
 * The binding placeholder may like: <%=title%>, <%=sub_title%>, <%=PROPERTY_LIST%>.
 *
 * @param baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param templateData {Object} the template data used for template interpolate. The constant array property
 *            'PROPERTY_LIST' should be defined in templateData if it's been used in node template. For example:
 *            <p>
 *            baseTemplateString='<g><text>{PropertyBinding("<%=title%>")}</text><g><%=PROPERTY_LIST%></g></g>'
 *
 * templateData = { title: 'object_name', sub_title: 'object_id', PROPERTY_LIST: ['propName1', 'propName2'] }
 * </p>
 * @return the constructed template string
 */
var constructNodeTemplate = function( baseTemplateString, templateData ) {
    if( !baseTemplateString ) {
        return '';
    }

    var bindData = {};
    if( templateData ) {
        bindData = _.clone( templateData );
    }

    if( !bindData.property_list ) {
        bindData.property_list = [];
    }
    var nodeTemplate = _.template( baseTemplateString, _nodeTemplateInterpolate );
    return nodeTemplate( bindData );
};

/**
 * Construct the node template from a base template with the bind properties. The first two properties will be
 * interpolate to title and sub_title. The remaining properties will bind to property list.
 *
 * @param {String} templateId the template ID of the constructed template.
 *          If not given, the template ID will be the string of bind property Names joined by '-'.
 * @param {String} baseTemplateString the base template string with interpolate delimiter '<%= %>'.
 * @param {String[]} propertyNames the array of bind property names
 * @return {String} the generated template string with bind property names been interpolated.
 */
var getTemplateContent = function( templateId, baseTemplateString, propertyNames ) {
    var templateData = {
        template_id: null,
        title: null,
        title_editable: null,
        sub_title: null,
        sub_title_editable: null,
        property_list: []
    };

    if( propertyNames instanceof Array ) {
        if( !templateId ) {
            templateId = propertyNames.join( '-' );
        }

        var len = propertyNames.length;
        if( len > 0 ) {
            templateData.title = propertyNames[ 0 ];
            templateData.title_editable = propertyNames[ 0 ] + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }

        if( len > 1 ) {
            templateData.sub_title = propertyNames[ 1 ];
            templateData.sub_title_editable = propertyNames[ 1 ] + graphTemplateService.EDITABLE_PROPERTY_SURFIX;
        }

        if( len > 2 ) {
            templateData.property_list = propertyNames.slice( 2 );
        }
    }

    if( templateId ) {
        templateData.template_id = templateId;
    }

    return constructNodeTemplate( baseTemplateString, templateData );
};

/**
 * Get node template by populate the base template with given binding property names
 */
export let getNodeTemplate = function( nodeTemplateCache, propertyNames, isGroup, useMultiLevelTemplate ) {
    //template doesn't exist, construct it and put in template cache
    var baseTemplateId;

    if( isGroup ) {
        baseTemplateId = GROUP_NODE_TEMPLATE_NAME;
    } else {
        baseTemplateId = NODE_TEMPLATE_NAME;
    }

    var baseTemplate = nodeTemplateCache[ baseTemplateId ];
    if( !baseTemplate ) {
        logger.error( 'SVG template has not been registered. Template ID: ' + baseTemplateId );
        return null;
    }

    var templateId = baseTemplateId;
    if( propertyNames && propertyNames.length > 0 ) {
        templateId += TEMPLATE_ID_DELIMITER;
        templateId += propertyNames.join( TEMPLATE_ID_DELIMITER );
    }

    var template = nodeTemplateCache[ templateId ];
    if( template ) {
        return template;
    }

    var newTemplate = _.cloneDeep( baseTemplate );
    newTemplate.templateId = templateId;
    newTemplate.templateContent = getTemplateContent( templateId, baseTemplate.templateContent, propertyNames );

    //cache the new template
    nodeTemplateCache[ templateId ] = newTemplate;
    return newTemplate;
};

/**
 * Get cell property names for the node object.
 *
 * @param nodeObject the node model object
 * @return the array of cell property names
 */
export let getBindPropertyNames = function( nodeObject ) {
    var properties = [];
    if( nodeObject.props && nodeObject.props[ PROPERTY_NAME ] ) {
        var propsArray = nodeObject.props[ PROPERTY_NAME ].uiValues;
        _.forEach( propsArray, function( prop ) {
            var nameValue = prop.split( TEMPLATE_VALUE_CONN_CHAR );
            properties.push( nameValue[ 0 ] );
        } );
    }
    return properties;
};

var setNodeThumbnailProperty = function( nodeObject, bindProperties ) {
    if( !awIconSvc ) {
        return;
    }

    var imageUrl = awIconSvc.getThumbnailFileUrl( nodeObject );

    //show type icon instead if thumbnail doesn't exist
    if( !imageUrl ) {
        imageUrl = awIconSvc.getTypeIconFileUrl( nodeObject );
    }

    bindProperties[ THUMBNAIL_URL ] = graphStyleUtils.getSVGImageTag( imageUrl );

    bindProperties.MRM0ToggleChildren_icon = cmdChild;
};

var setHoverNodeProperties = function( properties, hoveredClass ) {
    if( hoveredClass ) {
        properties[ exports.NODE_HOVERED_CLASS ] = hoveredClass;
        properties[ exports.TEXT_HOVERED_CLASS ] = hoveredClass;
    } else {
        properties[ exports.NODE_HOVERED_CLASS ] = 'aw-graph-noeditable-area';
        properties[ exports.TEXT_HOVERED_CLASS ] = '';
    }
};

var setRootNodeProperties = function( properties, isRoot ) {
    properties[ IS_ROOT ] = isRoot;
    properties[ COLOR_BAR_WIDTH ] = 10;

    if( isRoot ) {
        properties[ ROOTNODE_BORDER_STYLE ] = 'aw-relations-seedNodeSvg';
    } else {
        properties[ ROOTNODE_BORDER_STYLE ] = 'aw-relations-noneSeedNodeSvg';
    }
};

/**
 * Get the binding properties for the given node object
 *
 * @param nodeObject the node model object
 * @param propertyNames the names of node object property to display
 * @return the object including all the required binding properties for a node template
 */
export let getBindProperties = function( nodeObject, isRoot ) {
    var properties = {};

    if( nodeObject && nodeObject.props && nodeObject.props[ PROPERTY_NAME ] ) {
        var propsArray = nodeObject.props[ PROPERTY_NAME ].uiValues;
        for( var i = 0; i < propsArray.length; ++i ) {
            var nameValue = propsArray[ i ].split( TEMPLATE_VALUE_CONN_CHAR );
            properties[ nameValue[ 0 ] ] = i > 1 ? nameValue[ 0 ] + ': ' + nameValue[ 1 ] : nameValue[ 1 ];
            if( i === 0 ) {
                properties.Title = nameValue[ 0 ];
            }
        }
    }

    setHoverNodeProperties( properties, null );
    setRootNodeProperties( properties, isRoot );

    //get thumbnail for node
    setNodeThumbnailProperty( nodeObject, properties );

    properties.children_full_loaded = true;
    return properties;
};

export default exports = {
    NODE_HOVERED_CLASS,
    TEXT_HOVERED_CLASS,
    useMultiLevelTemplate,
    getNodeTemplate,
    getBindPropertyNames,
    getBindProperties
};
