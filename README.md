LABORATORIUM: Programowanie Full-Stack w Chmurze Obliczeniowej
ZADANIE NR 2

Autor: Michał Wójtowicz

CZĘŚĆ 1 (OBOWIĄZKOWA)
==================================

1. Wybór technologii i cechy implementacji
Zgodnie z wymogami zadania wybrałem stack MEAN.
Składają się na niego:
- MongoDB (baza danych)
- Express.js (backend)
- AngularJS (frontend) - warstwa prezentacji (wstrzyknięta w HTML)
- Node.js (runtime)

Istotne cechy implementacji w środowisku Minikube:
Wykorzystałem specyfikę Kubernetesa, dzieląc system na dwa typy serwisów. Node.js działa jako serwis bezstanowy – nie przechowuje danych, więc jego skalowanie jest proste i bezpieczne. MongoDB natomiast wymaga zachowania stanu. W Minikube zrealizowałem to tak, aby zapewnić trwałość danych na dysku oraz stałą nazwę sieciową, co jest niezbędne, by aplikacja nie gubiła połączenia z bazą po restartach.

2. Architektura w klastrze
Aplikację uruchomiłem w architekturze mikroserwisowej, dzieląc ją na dwa główne elementy:

A) Baza danych (MongoDB)
Zamiast zwykłego Deploymentu użyłem obiektu "StatefulSet". Baza danych musi zachować swoją unikalną tożsamość w sieci (stała nazwa "mongo-db-0") oraz, co najważniejsze, dane na wolumenie (PersistentVolumeClaim). Zwykły Deployment przy restarcie mógłby zgubić te powiązania. Do komunikacji skonfigurowałem serwis typu "Headless" (ClusterIP: None). Dzięki temu aplikacja nie łączy się przez load balancer, ale bezpośrednio z konkretnym adresem IP instancji bazy.

B) Aplikacja (Node.js/Angular)
Warstwa aplikacji jest bezstanowa, więc tutaj zastosowałem standardowy obiekt "Deployment". Skonfigurowałem 3 repliki, aby zapewnić wysoką dostępność. W praktyce oznacza to, że ruch jest rozkładany na trzy kontenery, a awaria jednego z nich nie powoduje przerwy w działaniu serwisu.

C) Dostęp zewnętrzny
Całość wystawiłem na zewnątrz klastra przy użyciu Ingressa, mapując domenę "http://brilliantapp.zad".

3. Pliki konfiguracyjne (katalog /k8s)
Wdrożenie opiera się na następujących plikach:
- 00-namespace.yaml (separacja zasobów)
- 01-configmap.yaml oraz 02-secret.yaml (zmienne i hasła)
- 03-mongo-statefulset.yaml (definicja bazy)
- 04-mongo-service.yaml (serwis headless dla bazy)
- 05-app-deployment.yaml (definicja aplikacji i sond)
- 06-app-service.yaml (serwis wewnętrzny aplikacji)
- 07-ingress.yaml (routing domeny brilliantapp.zad)

4. Uruchomienie wdrożenia
Aby uruchomić system, wykonałem następującą sekwencję poleceń:
- Najpierw przełączyłem środowisko dockera na minikube komendą "eval $(minikube docker-env)" i zbudowałem obraz lokalnie, aby klaster miał do niego dostęp.
- Następnie zaaplikowałem wszystkie pliki konfiguracyjne komendą "kubectl apply -f ."
-* W moim przypadku koniecznym krokiem było uruchomienie tunelowania ("minikube tunnel"). Ponieważ pracuję na systemie Windows z WSL, jest to niezbędne, aby Ingress Controller otrzymał zewnętrzny adres IP i mógł obsłużyć ruch na domenie brilliantapp.zad. Bez tego kroku strona byłaby nieosiągalna z poziomu przeglądarki w Windows.*

5. Weryfikacja (Screenshoty)
Poprawność wykonania zadania potwierdzają zrzuty ekranu w folderze screenshots:
- "1_wdrozenie_v1_browser.png" - Widać w pełni działającą stronę. Formularz AngularJS reaguje na dane, a status bazy to "połączono".
- "2_wdrozenie_terminal.png" - Terminal potwierdza architekturę HA: widać 3 działające pody aplikacji oraz pod bazy danych.

===============================================================
CZĘŚĆ 2 - SONDY
===============================================================

W celu zwiększenia stabilności wdrożenia, w pliku "05-app-deployment.yaml" dodałem konfigurację sond.

- LivenessProbe (endpoint /health)
Sonda ta cyklicznie sprawdza, czy proces Node.js odpowiada. Jej celem jest wykrycie sytuacji, w której aplikacja się zawiesiła i przestała przetwarzać żądania, mimo że kontener działa. W takim przypadku Kubernetes automatycznie zrestartuje kontener.

- ReadinessProbe (endpoint /ready)
Sonda gotowości sprawdza, czy aplikacja nawiązała połączenie z MongoDB. Dzięki niej Kubernetes nie przekieruje ruchu użytkowników do kontenera, który jeszcze nie połączył się z bazą. Eliminuje to błędy typu "Database Error" wyświetlane użytkownikom tuż po wdrożeniu.

Dowód konfiguracji znajduje się na screenie "3_sondy_proof.png" (sekcja Liveness i Readiness w opisie deploymentu).

===============================================================
CZĘŚĆ 3 - AKTUALIZACJA ZERO-DOWNTIME
===============================================================

Przeprowadziłem aktualizację aplikacji z wersji v1 do v2 bez przerywania jej działania.

1. Opis zmian i weryfikacja poprawności
W ramach aktualizacji zmieniłem obraz kontenera oraz zmienną środowiskową "APP_VERSION".
Zmiany widoczne dla użytkownika:
- Kolor tła zmienił się z niebieskiego na zielony.
- Numer wersji na stronie zmienił się na "v2".

Istota zmian technicznych:
Aktualizacja nie była prostą podmianą plików statycznych. Zmiana polegała na zmodyfikowaniu definicji Deploymentu (nowy obraz + nowa zmienna środowiskowa). Wymusiło to na Kubernetesie proces "Rolling Update", czyli stopniową wymianę kontenerów. Nowa wersja aplikacji, dzięki zmiennej środowiskowej, zmieniła wygląd, ale - co najważniejsze - automatycznie nawiązała połączenie z istniejącą, niezależną bazą danych. Dowodzi to, że aktualizacja warstwy aplikacji nie naruszyła warstwy danych.

2. Zmiany w plikach konfiguracyjnych
Aby zapewnić proces bezprzestojowy, w pliku "05-app-deployment.yaml" jawnie zdefiniowałem strategię "RollingUpdate".
Ustawiłem parametry:
- maxUnavailable: 1 (Oznacza to, że podczas aktualizacji zawsze muszą być dostępne przynajmniej 2 z 3 replik. Gwarantuje to ciągłość obsługi ruchu).
- maxSurge: 1 (Pozwala Kubernetesowi uruchomić jeden dodatkowy, czwarty kontener z nową wersją, zanim wyłączy stary. Przyspiesza to proces wymiany).

3. Ilustracja procesu
Aktualizację uruchomiłem z linii poleceń używając "kubectl set image" oraz "kubectl set env". Dzięki skonfigurowanej strategii, system wymieniał pody jeden po drugim, utrzymując dostępność usługi.

Dowód:
Na zrzucie "4_update_v2_browser.png" widać efekt końcowy: zielona aplikacja w wersji v2, która po aktualizacji działa poprawnie i jest połączona z bazą danych.
