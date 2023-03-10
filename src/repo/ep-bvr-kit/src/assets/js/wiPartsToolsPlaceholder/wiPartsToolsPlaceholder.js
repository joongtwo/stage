//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Placeholder plugin for parts-tools element
 */
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';

const PARTS_TOOLS_ELEMENT = 'parts-tools';
const PARTS_TOOLS_PLACEHOLDER_CLASS = 'aw-epInstructionsEditor-partsToolsPlaceholder';

export default class WIPartsToolsPlaceholder extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }
    init() {
        this._defineSchema();
        this._defineConverters();
        this.editor.editing.mapper.on(
            'viewToModelPosition',
            ckeditor5ServiceInstance.viewToModelPositionOutsideModelElement(
                this.editor.model, viewElement => viewElement.hasClass( PARTS_TOOLS_PLACEHOLDER_CLASS ) )
        );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( PARTS_TOOLS_ELEMENT, {
            allowWhere: '$text',
            isInline: true,
            isObject: true,
            allowAttributesOf: '$text',
            allowAttributes: [ 'name', 'uid' ]
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: PARTS_TOOLS_ELEMENT,
                classes: [ PARTS_TOOLS_PLACEHOLDER_CLASS ]
            },
            model: ( viewElement, { writer: modelWriter } ) => {
                const name = viewElement.getChild( 0 ).data;
                const uid = viewElement._attrs.get( 'uid' );
                return modelWriter.createElement( PARTS_TOOLS_ELEMENT, { name, uid } );
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: PARTS_TOOLS_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => {
                const widgetElement = createPlaceholderView( modelItem, viewWriter );
                return ckeditor5ServiceInstance.toWidget( widgetElement, viewWriter );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: PARTS_TOOLS_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => createPlaceholderView( modelItem, viewWriter )
        } );

        /**
         * 
         * @param {Object} modelItem model item
         * @param {Object} viewWriter view writer
         * @returns {object} placeholder view
         */
        function createPlaceholderView( modelItem, viewWriter ) {
            const name = modelItem.getAttribute( 'name' );
            const uid = modelItem.getAttribute( 'uid' );

            const placeholderView = viewWriter.createContainerElement( PARTS_TOOLS_ELEMENT, {
                class: PARTS_TOOLS_PLACEHOLDER_CLASS,
                uid: uid
            }, {
                isAllowedInsideAttributeElement: true
            } );

            const innerText = viewWriter.createText( name );
            viewWriter.insert( viewWriter.createPositionAt( placeholderView, 0 ), innerText );

            return placeholderView;
        }
    }
}


