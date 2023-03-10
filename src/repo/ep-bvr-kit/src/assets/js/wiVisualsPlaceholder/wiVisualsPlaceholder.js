//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Placeholder plugin for visuals element
 */
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';

const VISUALS_ELEMENT = 'visuals';

export default class WIVisualsPlaceholder extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }
    init() {
        this._defineSchema();
        this._defineConverters();
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( VISUALS_ELEMENT, {
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
                name: VISUALS_ELEMENT
            },
            model: ( viewElement, { writer: modelWriter } ) => {
                const name = viewElement._attrs.get( 'name' );
                const uid = viewElement._attrs.get( 'uid' );
                return modelWriter.createElement( VISUALS_ELEMENT, { name, uid } );
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: VISUALS_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => {
                const widgetElement = createPlaceholderView( modelItem, viewWriter );
                return ckeditor5ServiceInstance.toWidget( widgetElement, viewWriter );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: VISUALS_ELEMENT,
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

            const placeholderView = viewWriter.createContainerElement( VISUALS_ELEMENT, {
                uid: uid,
                name: name
            }, {
                isAllowedInsideAttributeElement: true
            } );

            const innerText = viewWriter.createUIElement( 'span', null, function( domDocument ) {
                const domElement = this.toDomElement( domDocument );
                domElement.innerHTML = 'as seen in: <span style="color:#006487">' + name + ' </span>';

                return domElement;
            } );

            viewWriter.insert( viewWriter.createPositionAt( placeholderView, 0 ), innerText );

            return placeholderView;
        }
    }
}


