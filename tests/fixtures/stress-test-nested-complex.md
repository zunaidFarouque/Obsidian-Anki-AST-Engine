---
AnkiSync: on

cardDeclarationHeadingLevel: 4

---



# Distributed Systems



This note covers distributed systems. Should we use a queue or direct calls?



See [[Internal Note]] for context.



![[Diagram.png]]



The nested section below is transcluded from another note:



![[ChildNote#^section-id]]



```js

const result = condition ? true : false;

```



#### Message Broker



What is a message broker?



Why do teams introduce one between services?



:::



A system that stores and forwards messages between producers and consumers.



It decouples senders from receivers and can smooth traffic spikes.



Common examples include RabbitMQ and Kafka.
<!--anki-id: f79f0b18-1c3c-4ff9-b425-7ec8e7909261-->


