// DONNÉ, ne pas modifier. Le contrat minimal d'un événement de domaine.
//
// `id` n'est pas l'identifiant de l'entité concernée : c'est l'identifiant du FAIT lui-même.
// Il existe parce qu'un transport réel livre « au moins une fois » : le même fait peut être
// présenté deux fois au même consommateur. Sans identité du fait, impossible de distinguer
// « ça s'est produit deux fois » de « on me le raconte deux fois ».
//
// Ce fichier est le SEUL noyau partagé entre les deux agrégats de ce lab. Un noyau partagé se
// garde minuscule et explicite : tout ce qu'on y pose, les deux côtés doivent le subir.
export interface DomainEvent {
  readonly kind: string;
  readonly id: string;
}
