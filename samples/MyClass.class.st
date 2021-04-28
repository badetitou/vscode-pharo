Class {
     #name: #MyClass,
    #superclass: #Object,
    #instVars: [ #myVar2 ],
    #category : #'MyPackage'
}

{ #category : #accessing }
MyClass >> helloWorld [
    ^ 'hello world'
]

{ #category : #accessing }
MyClass >> myVar2 [
    ^ myVar2
]

{ #category : #accessing }
MyClass >> myVar2: anObject [
    myVar2 := anObject
]