// DONNÉ, ne pas modifier. Un fait PERSISTÉ, tel que le journal te le rend.
//
// Trois identités cohabitent ici, et les confondre est la première erreur de l'event sourcing :
//
//  - `streamId` : à QUI le fait est arrivé (ici, une cagnotte). Un flux par agrégat.
//  - `version`  : le RANG du fait DANS SON FLUX, à partir de 1. C'est lui qui porte la
//                 concurrence optimiste : écrire la version 4 n'est légitime que si le flux est
//                 encore à la version 3.
//  - `position` : le rang du fait dans le journal GLOBAL, tous flux confondus. C'est lui qu'une
//                 projection mémorise comme point de reprise.
//
// `payload` est volontairement `unknown`, et ce n'est pas de la prudence de façade : un fait relu
// d'une base est du JSON. Il ne passe plus `instanceof`, et s'il a été écrit il y a un an il n'a
// pas la forme que ton code attend aujourd'hui. C'est le travail de `materialiser`.
export interface StoredEvent {
  readonly position: number;
  readonly streamId: string;
  readonly version: number;
  readonly kind: string;
  readonly payload: unknown;
}
